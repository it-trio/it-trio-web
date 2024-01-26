// 先頭の改行を削除し、連続する改行を1つにする
export const removeUnnecessaryNewLines = (text: string): string => {
  return text.replace(/^\n+/, "").replace(/\n+/g, "\n");
};
