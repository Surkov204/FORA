export default function Avatar({
  src,
  alt = "avatar",
  className = "",
  onClick,
  title,
}) {
  const fallback = "https://via.placeholder.com/40";
  return (
    <img
      src={src || fallback}
      alt={alt}
      className={className}
      onClick={onClick}
      title={title}
      style={{ cursor: onClick ? "pointer" : "default" }}
    />
  );
}
