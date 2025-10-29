"""Content generation helpers leveraging Gemini."""

from typing import Optional

from PIL import Image

from .gemini import get_model


STYLE_PROMPTS = {
"Tiếp thị": """
    Viết theo phong cách MARKETING mạnh mẽ và giàu cảm xúc.
    Dùng ngôn từ gợi cảm, kích thích mong muốn sở hữu, nhấn mạnh LỢI ÍCH và GIÁ TRỊ ĐẶC BIỆT của sản phẩm.
    Tạo cảm giác KHAN HIẾM, ĐỘC QUYỀN và thôi thúc hành động (CTA) mạnh mẽ.
    Giọng văn nên ngắn gọn, dồn dập, lôi cuốn như một chiến dịch quảng cáo cao cấp.
""",

"Chuyên nghiệp": """
    Viết theo phong cách CHUYÊN NGHIỆP, đáng tin cậy và chuẩn mực.
    Nhấn mạnh THÔNG TIN CHÍNH XÁC về nguồn gốc, chất lượng, tiêu chuẩn sản xuất và chứng nhận.
    Giọng văn mang tính học thuật nhẹ, thể hiện sự UY TÍN và CAM KẾT của thương hiệu.
    Tránh sáo rỗng, tập trung vào GIÁ TRỊ THỰC và SỰ KHÁC BIỆT của sản phẩm.
""",

"Thân thiện": """
    Viết theo phong cách THÂN THIỆN, tự nhiên và gần gũi như đang trò chuyện với người quen.
    Dùng ngôn từ nhẹ nhàng, dễ hiểu, pha chút hài hước hoặc cảm xúc đời thường.
    Tạo cảm giác TIN CẬY và GẮN KẾT, giúp người đọc thấy bạn đang THẬT LÒNG chia sẻ sản phẩm tốt.
    Giọng văn nên mang năng lượng tích cực, vui vẻ và chân thành.
""",

"Kể chuyện": """
    Viết theo phong cách KỂ CHUYỆN, dẫn dắt bằng cảm xúc và trải nghiệm thực tế.
    Mở đầu bằng một câu chuyện ngắn, gợi tò mò, sau đó khéo léo lồng ghép thông tin sản phẩm.
    Hãy khiến người đọc như đang sống trong câu chuyện đó, cảm nhận được HÀNH TRÌNH và GIÁ TRỊ mà sản phẩm mang lại.
    Kết thúc bằng một thông điệp cảm động hoặc lời kêu gọi tinh tế, khơi gợi mong muốn trải nghiệm.
""",

}


def get_style_prompt(style: str) -> str:
    """Return the Gemini writing style prompt."""
    return STYLE_PROMPTS.get(style, STYLE_PROMPTS["Tiếp thị"])


def _image_prompt(style: str) -> str:
    return f"""Hãy hóa thân thành một chuyên gia tiếp thị giàu cảm xúc.
Nhiệm vụ: Viết bài mô tả bán hàng cho sản phẩm TRÁI CÂY trong hình ảnh. 
{get_style_prompt(style)}

Hãy viết sao cho người đọc CẢM NHẬN được hương vị, màu sắc và giá trị thật của sản phẩm — không chỉ đọc mà còn muốn MUA NGAY.

Trả về nội dung theo định dạng sau:

🎯 [Tiêu đề sản phẩm ngắn gọn, có từ khóa SEO, thu hút và gợi cảm xúc]

✨ [Slogan 1 câu ấn tượng, có thể kèm emoji hoặc chơi chữ nhẹ]

📝 Mô tả:
[100-150 từ sinh động, kể lại trải nghiệm thưởng thức, nhấn mạnh nguồn gốc, độ tươi, hương vị và lợi ích. 
Giọng văn nên giàu cảm xúc, mời gọi và truyền cảm hứng mua hàng.]

💎 Điểm nổi bật:
• [Chất lượng vượt trội hoặc quy trình canh tác đặc biệt]
• [Nguồn gốc rõ ràng, vùng trồng nổi tiếng]
• [Hương vị đặc trưng - ngọt thanh, giòn mát, thơm tự nhiên…]
• [Giá trị dinh dưỡng và lợi ích sức khỏe]
• [Độ tươi mới - cam kết từ vườn đến tay người mua]

🌟 Lợi ích:
[3-4 lợi ích thực tế - ví dụ: tốt cho sức khỏe, giúp thư giãn, phù hợp làm quà biếu…]

🎁 Cam kết:
[Đảm bảo chất lượng, đổi trả linh hoạt, giao hàng tận nơi, hỗ trợ tận tình]

🍽️ Gợi ý:
[2-3 cách dùng sáng tạo - ví dụ: ăn trực tiếp, làm sinh tố, chế biến món tráng miệng]

#️⃣ Từ khóa:
[5-7 hashtag hoặc từ khóa phổ biến, cách nhau bằng dấu phẩy]

Viết bằng TIẾNG VIỆT tự nhiên, cảm xúc, mạch lạc và mang năng lượng tích cực.và kết quả trả về không có giấu *
"""


def _text_prompt(product_info: str, style: str) -> str:
    return f"""Bạn là chuyên gia nội dung thương mại điện tử, hãy viết bài mô tả hấp dẫn cho sản phẩm:
"{product_info}" 
{get_style_prompt(style)}

Mục tiêu: khiến người đọc CẢM NHẬN được giá trị và muốn sở hữu sản phẩm ngay lập tức.
Giọng văn nên tự nhiên, truyền cảm, phù hợp với khách hàng Việt Nam hiện đại.

Trả về nội dung theo định dạng:

🎯 [Tiêu đề sản phẩm ngắn gọn, chứa từ khóa chính và gợi tò mò]

✨ [Slogan 1 câu sáng tạo - dễ nhớ, tạo ấn tượng đầu tiên mạnh mẽ]

📝 Mô tả:
[Khoảng 100-150 từ mô tả hấp dẫn, khơi gợi cảm xúc, nêu rõ nguồn gốc, hương vị, giá trị, lợi ích và lý do nên chọn sản phẩm này.
Hãy khiến người đọc như đang “nếm thử bằng trí tưởng tượng”.]

💎 Điểm nổi bật:
• [Chất lượng / quy trình đặc biệt]
• [Nguồn gốc / vùng trồng uy tín]
• [Hương vị tự nhiên]
• [Giá trị dinh dưỡng]
• [Độ tươi và độ an toàn]

🌟 Lợi ích:
[3-4 lợi ích rõ ràng, nhấn mạnh giá trị cho sức khỏe và cảm xúc]

🎁 Cam kết:
[Chất lượng chuẩn, giao hàng nhanh, hỗ trợ tận tâm, đổi trả linh hoạt]

🍽️ Gợi ý:
[2-3 cách dùng sáng tạo - ví dụ: kết hợp món ăn, quà tặng, thức uống…]

#️⃣ Từ khóa:
[5-7 hashtag hoặc từ khóa tìm kiếm, ngăn cách bằng dấu phẩy]

Viết TIẾNG VIỆT tự nhiên, tràn đầy năng lượng, truyền cảm hứng mua hàng.
không có giấu * trong mô tả của tôi
"""



def _sanitize_output(text: str) -> str:
    return text.replace("*", "")


def generate_from_image(api_key: str, image: Image.Image, style: str) -> str:
    """Generate a product description from an image."""
    model = get_model(api_key)
    response = model.generate_content([_image_prompt(style), image])
    return _sanitize_output(response.text) if response and response.text else ""


def generate_from_text(api_key: str, product_info: str, style: str) -> str:
    """Generate a product description from product information text."""
    model = get_model(api_key)
    response = model.generate_content(_text_prompt(product_info, style))
    return _sanitize_output(response.text) if response and response.text else ""
