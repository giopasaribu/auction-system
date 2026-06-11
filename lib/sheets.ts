export function csvExportUrl(sheetsUrl: string): string | null {
  const idMatch = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];

  const gidMatch = sheetsUrl.match(/[#&]gid=(\d+)/);
  const gid = gidMatch?.[1];

  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  return gid ? `${url}&gid=${gid}` : url;
}
