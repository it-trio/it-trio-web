const ART19_BASE_URL = "https://art19.com";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type ItunesType = "full" | "bonus" | "trailer";

export interface Season {
  id: string;
  seasonNumber: number;
  title: string;
}

export interface CreateEpisodeInput {
  seriesId: string;
  seasonId?: string;
  title: string;
  description: string;
  descriptionIsHtml: boolean;
  publishAtIso: string;
  itunesType: ItunesType;
}

export interface CreateEpisodeVersionInput {
  episodeId: string;
  sourceUrl: string;
}

export interface EpisodeVersion {
  processingStatus: string;
  validationErrors: string[];
}

interface JsonApiResource {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
}

interface JsonApiDocument {
  data?: JsonApiResource | JsonApiResource[];
  errors?: Array<{ detail?: string; title?: string }>;
  links?: { next?: string };
}

export class Art19ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "Art19ApiError";
    this.status = status;
    this.body = body;
  }
}

export class EpisodeVersionProcessingError extends Error {
  readonly validationErrors: string[];

  constructor(validationErrors: string[]) {
    super(
      validationErrors.length > 0
        ? `Episode version processing failed: ${validationErrors.join("; ")}`
        : "Episode version processing failed.",
    );
    this.name = "EpisodeVersionProcessingError";
    this.validationErrors = validationErrors;
  }
}

function parseJsonApiError(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const errors = (body as JsonApiDocument).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }

  const first = errors[0];
  return first.detail ?? first.title;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Art19Client {
  private readonly token: string;
  private readonly credential: string;

  constructor({ token, credential }: { token: string; credential: string }) {
    this.token = token;
    this.credential = credential;
  }

  async getSeasons({ seriesId }: { seriesId: string }): Promise<Season[]> {
    const seasons: Season[] = [];
    let nextPath: string | null =
      `/seasons?series_id=${encodeURIComponent(seriesId)}&page[number]=1&page[size]=100&sort=season_number`;

    while (nextPath !== null) {
      const currentPath: string = nextPath;
      nextPath = null;

      const document: JsonApiDocument = await this.request<JsonApiDocument>(
        "GET",
        currentPath,
      );
      const data = document.data;
      const resources = Array.isArray(data) ? data : data ? [data] : [];

      for (const resource of resources) {
        const attributes = resource.attributes ?? {};
        seasons.push({
          id: resource.id ?? "",
          seasonNumber: Number(attributes.season_number ?? 0),
          title: String(attributes.title ?? ""),
        });
      }

      const nextLink: string | undefined = document.links?.next;
      if (nextLink) {
        const nextUrl: URL = new URL(nextLink);
        nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      }
    }

    return seasons.filter((season) => season.id.length > 0);
  }

  async createEpisode(input: CreateEpisodeInput): Promise<{ id: string }> {
    const body = {
      data: {
        type: "episodes",
        attributes: {
          title: input.title,
          description: input.description,
          description_is_html: input.descriptionIsHtml,
          released_at: input.publishAtIso,
          published: true,
          release_immediately: false,
          itunes_type: input.itunesType,
        },
        relationships: {
          series: {
            data: { type: "series", id: input.seriesId },
          },
          ...(input.seasonId
            ? {
                season: {
                  data: { type: "seasons", id: input.seasonId },
                },
              }
            : {}),
        },
      },
    };

    const document = await this.request<JsonApiDocument>("POST", "/episodes", body);
    const id = this.extractResourceId(document.data);
    if (!id) {
      throw new Art19ApiError("Episode created but no ID returned.", 201, document);
    }

    return { id };
  }

  async createEpisodeVersion(
    input: CreateEpisodeVersionInput,
  ): Promise<{ id: string }> {
    const body = {
      data: {
        type: "episode_versions",
        attributes: {
          source_url: input.sourceUrl,
        },
        relationships: {
          episode: {
            data: { type: "episodes", id: input.episodeId },
          },
        },
      },
    };

    const document = await this.request<JsonApiDocument>(
      "POST",
      "/episode_versions",
      body,
    );
    const id = this.extractResourceId(document.data);
    if (!id) {
      throw new Art19ApiError(
        "Episode version created but no ID returned.",
        201,
        document,
      );
    }

    return { id };
  }

  async getEpisodeVersion(id: string): Promise<EpisodeVersion> {
    const document = await this.request<JsonApiDocument>(
      "GET",
      `/episode_versions/${encodeURIComponent(id)}`,
    );
    const resource = this.extractResource(document.data);
    const attributes = resource?.attributes ?? {};

    return {
      processingStatus: String(attributes.processing_status ?? ""),
      validationErrors: asStringArray(attributes.validation_errors),
    };
  }

  async pollEpisodeVersion(
    id: string,
    opts: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<{ status: "ready" }> {
    const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;
    const intervalMs = opts.intervalMs ?? 5000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const version = await this.getEpisodeVersion(id);

      if (version.validationErrors.length > 0) {
        throw new EpisodeVersionProcessingError(version.validationErrors);
      }

      if (
        version.processingStatus === "active" ||
        version.processingStatus === "inactive"
      ) {
        return { status: "ready" };
      }

      if (
        version.processingStatus === "processing_failed" ||
        version.processingStatus === "validation_failed"
      ) {
        throw new EpisodeVersionProcessingError(version.validationErrors);
      }

      await sleep(intervalMs);
    }

    throw new Error(
      `Timed out waiting for episode version ${id} to finish processing.`,
    );
  }

  private extractResource(
    data: JsonApiResource | JsonApiResource[] | undefined,
  ): JsonApiResource | undefined {
    if (Array.isArray(data)) {
      return data[0];
    }
    return data;
  }

  private extractResourceId(
    data: JsonApiResource | JsonApiResource[] | undefined,
  ): string | undefined {
    return this.extractResource(data)?.id;
  }

  private buildAuthHeader(): string {
    return `Token token="${this.token}", credential="${this.credential}"`;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    attempt = 0,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.buildAuthHeader(),
      Accept: "application/vnd.api+json",
    };

    if (method !== "GET") {
      headers["Content-Type"] = "application/vnd.api+json";
    }

    const response = await fetch(`${ART19_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : 2 ** attempt;
      await sleep(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 2000);
      return this.request<T>(method, path, body, attempt + 1);
    }

    const responseText = await response.text();
    let parsedBody: unknown;
    if (responseText.length > 0) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText;
      }
    }

    if (!response.ok) {
      const detail = parseJsonApiError(parsedBody);
      throw new Art19ApiError(
        detail ?? `ART19 API request failed with status ${response.status}.`,
        response.status,
        parsedBody,
      );
    }

    return parsedBody as T;
  }
}
