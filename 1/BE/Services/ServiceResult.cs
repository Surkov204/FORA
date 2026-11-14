namespace FORA.Services
{
    public class ServiceResult
    {
        public int StatusCode { get; init; }
        public object Data { get; init; } = default!;

        public static ServiceResult From(int statusCode, object data)
        {
            return new ServiceResult
            {
                StatusCode = statusCode,
                Data = data
            };
        }
    }
}
