namespace FORA.DTOs
{
    public class CreatePostDto
    {
        public string Content { get; set; } = "";
        public List<string> MediaUrls { get; set; } = new List<string>();
    }
}
