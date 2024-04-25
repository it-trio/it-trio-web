import { SITE_TITLE } from "../consts";

export const generatePageTitle = (name: string) => {
  return `${name} - ${SITE_TITLE}`;
};
