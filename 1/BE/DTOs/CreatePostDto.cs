namespace FORA.DTOs
{
    public class CreatePostDto
    {
        public string Content { get; set; } = "";
        public List<string> MediaUrls { get; set; } = new List<string>();
        public CreatePostPollDto? Poll { get; set; }
        public string? QuestionTopic { get; set; }
    }
}
