export function session() {
  try {
    const token = localStorage.getItem("token");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp * 1000 <= Date.now()) return null;
    const id = Number(payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] || payload.sub);
    return Number.isInteger(id) && id > 0 ? { token, id } : null;
  } catch {
    return null;
  }
}
