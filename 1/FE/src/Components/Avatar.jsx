export default function Avatar({
  src,
  alt = "avatar",
  className = "",
  onClick,
  title,
}) {
  const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='110' height='110' viewBox='0 0 110 110'%3E%3Crect width='110' height='110' fill='%2316181c'/%3E%3Ccircle cx='55' cy='40' r='19' fill='%2371767b'/%3E%3Cpath d='M20 108v-9a35 35 0 0170 0v9' fill='%2371767b'/%3E%3C/svg%3E";
  return (
    <img
      src={src || fallback}
      onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = fallback; }}
      alt={alt}
      className={className}
      onClick={onClick}
      title={title}
      style={{ cursor: onClick ? "pointer" : "default" }}
    />
  );
}
