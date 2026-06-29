"""生成非遗藏品占位图片 + 扩展种子数据

用法:
    python scripts/generate_placeholders.py

功能:
    1. 为 heritage_sample.json 中的每个非遗项目生成占位图片
    2. 扩展种子数据到50+条记录
    3. 重新播种数据库
"""

import json
import os
import sys
from pathlib import Path

# 添加项目根目录到 path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw, ImageFont

# 配置
KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "data" / "uploads" / "knowledge"
HERITAGE_FILE = Path(__file__).resolve().parent.parent / "data" / "knowledge" / "heritage_sample.json"
DB_URL = "sqlite:///./data/database.sqlite"

# 扩展的非遗数据
EXTRA_HERITAGE = [
    # === 刺绣类 (补充) ===
    {"name": "京绣", "category": "刺绣", "region": "北京", "era": "明清",
     "description": "京绣又称宫绣，是以北京为中心的刺绣艺术总称，明清时期为宫廷御用，绣工精细、配色富丽、图案严谨，具有浓郁的皇家气派。",
     "techniques": [{"name": "平金绣", "desc": "以金线盘绣纹样，绣面金光灿烂"}, {"name": "打籽绣", "desc": "丝线打结成粒状排列"}, {"name": "盘金绣", "desc": "金线沿纹样盘绕固定"}],
     "inheritors": [{"name": "张凤兰", "title": "国家级传承人"}],
     "cultural_meaning": "京绣代表了中国皇家审美，象征权力与尊贵，是宫廷文化的重要载体。", "images": ["/static/knowledge/jingxiu_1.jpg"]},
    {"name": "杭绣", "category": "刺绣", "region": "浙江杭州", "era": "宋元",
     "description": "杭绣源于南宋宫廷刺绣，以齐针、参针、套针见长，风格清雅秀丽，与苏绣、湘绣、蜀绣、粤绣并称中国名绣。",
     "techniques": [{"name": "齐针", "desc": "针脚整齐排列，一丝不苟"}, {"name": "参针", "desc": "长短针交错，过渡自然"}],
     "inheritors": [{"name": "赵亦军", "title": "省级传承人"}],
     "cultural_meaning": "杭绣承载着杭州千年丝绸文化，是南宋宫廷美学的活态传承。", "images": ["/static/knowledge/hangxiu_1.jpg"]},

    # === 陶瓷类 (补充) ===
    {"name": "德化白瓷", "category": "陶瓷", "region": "福建德化", "era": "宋元",
     "description": "德化白瓷以白釉瓷塑闻名于世，瓷质洁白温润如玉，被称为'中国白'。明代何朝宗的白瓷观音像享誉海内外。",
     "techniques": [{"name": "瓷塑", "desc": "手工捏塑成型，造型栩栩如生"}, {"name": "白釉", "desc": "独特的白釉配方，温润若脂"}],
     "inheritors": [{"name": "柯宏荣", "title": "国家级传承人"}],
     "cultural_meaning": "德化白瓷是海上丝绸之路的重要商品，代表了中国白瓷制造的最高水平。", "images": ["/static/knowledge/dehuabaici_1.jpg"]},
    {"name": "汝窑天青釉", "category": "陶瓷", "region": "河南汝州", "era": "宋",
     "description": "汝窑居宋代五大名窑之首，天青釉色如雨过天晴，釉面开片如蝉翼。现存世汝窑不足百件，极为珍贵。",
     "techniques": [{"name": "天青釉", "desc": "以玛瑙入釉，呈现独特的天青色"}, {"name": "支钉烧", "desc": "满釉支烧，底留芝麻细小钉痕"}],
     "inheritors": [{"name": "朱文立", "title": "国家级传承人"}],
     "cultural_meaning": "汝窑代表了宋代极简美学的巅峰，是文人审美的物化象征。", "images": ["/static/knowledge/ruyao_1.jpg"]},
    {"name": "钧窑窑变釉", "category": "陶瓷", "region": "河南禹州", "era": "宋",
     "description": "钧窑以窑变釉色闻名，'入窑一色，出窑万彩'，釉色千变万化，有'钧瓷无双'之说。铜红釉的烧制成功是中国陶瓷史的重大突破。",
     "techniques": [{"name": "窑变", "desc": "利用铜铁元素在高温下的化学变化产生绚丽色彩"}, {"name": "铜红釉", "desc": "以铜为着色剂烧制红色釉面"}],
     "inheritors": [{"name": "任星航", "title": "国家级传承人"}],
     "cultural_meaning": "钧窑'天人合一'的窑变理念体现了中国哲学中顺应自然的思想。", "images": ["/static/knowledge/junyao_1.jpg"]},

    # === 雕塑类 (补充) ===
    {"name": "徽州三雕", "category": "雕塑", "region": "安徽黄山", "era": "明清",
     "description": "徽州三雕指砖雕、石雕、木雕，广泛用于徽派建筑装饰，雕刻精细、题材丰富，是徽文化的重要视觉表达。",
     "techniques": [{"name": "砖雕", "desc": "在青砖上浅浮雕故事人物"}, {"name": "木雕", "desc": "梁柱门窗上的精细雕花"}, {"name": "石雕", "desc": "牌坊石狮等大型石作"}],
     "inheritors": [{"name": "蒯正华", "title": "国家级传承人"}],
     "cultural_meaning": "徽州三雕承载着徽商的审美趣味和儒家文化理念，是中国传统建筑装饰的典范。", "images": ["/static/knowledge/huizhousandiao_1.jpg"]},
    {"name": "寿山石雕", "category": "雕塑", "region": "福建福州", "era": "明清",
     "description": "寿山石雕以福州寿山乡出产的彩石为原料，因材施艺，巧用石色，其中田黄石最为名贵，有'一两田黄三两金'之说。",
     "techniques": [{"name": "圆雕", "desc": "三维立体雕刻"}, {"name": "薄意", "desc": "浅浮雕技法，保留石皮自然纹理"}, {"name": "巧色", "desc": "利用石材天然色彩进行创作"}],
     "inheritors": [{"name": "冯久和", "title": "国家级传承人"}],
     "cultural_meaning": "寿山石雕体现了'天工人工、天人合一'的审美理想，是福州地方文化的重要名片。", "images": ["/static/knowledge/shoushanshi_1.jpg"]},

    # === 织锦类 (补充) ===
    {"name": "宋锦", "category": "织锦", "region": "江苏苏州", "era": "宋",
     "description": "宋锦与南京云锦、四川蜀锦并称中国三大名锦，质地坚柔、图案典雅，宋代用于宫廷服饰和书画装裱。",
     "techniques": [{"name": "三枚斜纹", "desc": "经纬三枚斜纹组织，质地紧密"}, {"name": "彩纬显花", "desc": "多种色纬交替显花"}],
     "inheritors": [{"name": "钱小萍", "title": "国家级传承人"}],
     "cultural_meaning": "宋锦代表了宋代织造技术的巅峰，其纹样体现了宋人崇尚自然、追求雅致的美学趣味。", "images": ["/static/knowledge/songjin_1.jpg"]},
    {"name": "蜀锦", "category": "织锦", "region": "四川成都", "era": "汉唐",
     "description": "蜀锦是中国最古老的织锦之一，汉唐时期经丝绸之路远销西方。以彩条经锦为特色，色彩鲜艳、图案丰满。",
     "techniques": [{"name": "经锦", "desc": "经线显花的古老织造技艺"}, {"name": "多综多蹑", "desc": "多片综框提花织机操作"}],
     "inheritors": [{"name": "贺斌", "title": "国家级传承人"}],
     "cultural_meaning": "蜀锦是丝绸之路上的重要商品，见证了东西方文明交流的历史。", "images": ["/static/knowledge/shujin_1.jpg"]},

    # === 金属工艺类 (补充) ===
    {"name": "龙泉宝剑锻制", "category": "金属", "region": "浙江龙泉", "era": "春秋",
     "description": "龙泉宝剑始于春秋时期，由欧冶子创制。以锋利、坚韧、装饰精美闻名，锻造工艺包含炼、锻、铲、锉、刻、淬、磨等28道工序。",
     "techniques": [{"name": "折叠锻打", "desc": "反复折叠锻打去除杂质"}, {"name": "淬火", "desc": "高温后急速冷却增强硬度"}, {"name": "磨剑", "desc": "手工精磨至刃如秋霜"}],
     "inheritors": [{"name": "沈新培", "title": "国家级传承人"}],
     "cultural_meaning": "龙泉宝剑承载着中国的侠义精神和工匠精神，是冷兵器时代中国的象征。", "images": ["/static/knowledge/longquanjian_1.jpg"]},
    {"name": "南京金箔锻制", "category": "金属", "region": "江苏南京", "era": "明清",
     "description": "南京金箔锻制技艺已有1700多年历史，将黄金打成0.1微米厚的金箔。故宫、天安门等古建筑修缮均使用南京金箔。",
     "techniques": [{"name": "化金", "desc": "将黄金熔炼为金条"}, {"name": "锤打", "desc": "数万次锤打成薄膜"}, {"name": "切箔", "desc": "以口风精准裁切"}],
     "inheritors": [{"name": "王必生", "title": "国家级传承人"}],
     "cultural_meaning": "金箔工艺是中国古代冶金技术高度发达的证明，象征着中华民族对完美的极致追求。", "images": ["/static/knowledge/jinbo_1.jpg"]},

    # === 漆器类 (补充) ===
    {"name": "平遥推光漆器", "category": "漆器", "region": "山西平遥", "era": "明清",
     "description": "平遥推光漆器始于唐朝，以手掌推光工艺使漆面光洁如镜，配以描金彩绘，是中国四大漆器之一。",
     "techniques": [{"name": "推光", "desc": "以手掌反复推擦使漆面光亮"}, {"name": "描金", "desc": "金粉调漆绘制纹饰"}, {"name": "彩绘", "desc": "天然矿物颜料绘制装饰图案"}],
     "inheritors": [{"name": "薛生金", "title": "国家级传承人"}],
     "cultural_meaning": "平遥推光漆器融合了实用与审美，是晋商文化的物质见证。", "images": ["/static/knowledge/pingyaoqi_1.jpg"]},

    # === 剪纸类 (补充) ===
    {"name": "蔚县剪纸", "category": "剪纸", "region": "河北蔚县", "era": "明清",
     "description": "蔚县剪纸以阴刻为主、阳刻为辅，色彩艳丽、构图饱满，是全国唯一以阴刻为主的点彩剪纸。",
     "techniques": [{"name": "阴刻", "desc": "刻去线条保留块面"}, {"name": "点彩", "desc": "以白酒调色逐层晕染"}, {"name": "熏样", "desc": "以煤油灯熏制图案模板"}],
     "inheritors": [{"name": "周广", "title": "国家级传承人"}],
     "cultural_meaning": "蔚县剪纸是北方农耕文化的视觉表达，每逢春节家家户户贴窗花祈福纳祥。", "images": ["/static/knowledge/yuxianjianzhi_1.jpg"]},
    {"name": "扬州剪纸", "category": "剪纸", "region": "江苏扬州", "era": "唐",
     "description": "扬州剪纸以宣纸为材，线条清秀流畅，构图雅致，擅长表现花卉、山水、仕女等文人题材。",
     "techniques": [{"name": "线刻", "desc": "以纤细线条勾勒轮廓"}, {"name": "套色", "desc": "多层色纸叠加套剪"}],
     "inheritors": [{"name": "张秀芳", "title": "国家级传承人"}],
     "cultural_meaning": "扬州剪纸是文人审美与民间工艺的完美结合，展现了中国剪纸艺术的精致一面。", "images": ["/static/knowledge/yangzhoujianzhi_1.jpg"]},

    # === 年画类 (新增) ===
    {"name": "杨柳青年画", "category": "年画", "region": "天津", "era": "明清",
     "description": "杨柳青年画始于明代，以木版套印与手工彩绘相结合，色彩鲜丽、人物生动，与苏州桃花坞年画并称'南桃北柳'。",
     "techniques": [{"name": "木版套印", "desc": "多色木版分色套印"}, {"name": "手工彩绘", "desc": "在印好线条上手工着色"}, {"name": "开脸", "desc": "人物面部精细描绘"}],
     "inheritors": [{"name": "霍庆有", "title": "国家级传承人"}],
     "cultural_meaning": "年画承载着中国人祈福禳灾、迎祥纳福的美好愿望，是中国年文化的核心视觉符号。", "images": ["/static/knowledge/yangliuqing_1.jpg"]},
    {"name": "桃花坞木版年画", "category": "年画", "region": "江苏苏州", "era": "明清",
     "description": "桃花坞年画源于宋代雕版印刷，构图丰满、色彩雅致，在技法上吸收了西洋铜版画的透视和明暗表现手法。",
     "techniques": [{"name": "木版水印", "desc": "多版套色水印技法"}, {"name": "饾版", "desc": "小块木版逐色印制"}],
     "inheritors": [{"name": "房志达", "title": "国家级传承人"}],
     "cultural_meaning": "桃花坞年画代表了中国民间版画的最高水平，对日本浮世绘也产生了深远影响。", "images": ["/static/knowledge/taohuawu_1.jpg"]},

    # === 皮影类 (补充) ===
    {"name": "华县皮影", "category": "皮影", "region": "陕西华县", "era": "明清",
     "description": "华县皮影是中国皮影艺术的发源地之一，以牛皮为原料，雕刻精细、造型古朴，唱腔为碗碗腔，有'中华一绝'的美誉。",
     "techniques": [{"name": "制皮", "desc": "牛皮经浸泡、刮薄、磨平"}, {"name": "雕镂", "desc": "推皮走刀法精细雕刻"}, {"name": "敷彩", "desc": "矿物颜料多层涂染"}],
     "inheritors": [{"name": "汪天稳", "title": "国家级传承人"}],
     "cultural_meaning": "华县皮影是研究中国戏曲史、美术史和民俗史的重要活态资料。", "images": ["/static/knowledge/huaxianpiying_1.jpg"]},

    # === 蓝印花布类 (补充) ===
    {"name": "南通蓝印花布", "category": "蓝印花布", "region": "江苏南通", "era": "宋元",
     "description": "南通蓝印花布以手工刻版、刮浆、染色为特色，蓝白相间、图案古朴，是中国传统印染工艺的活化石。",
     "techniques": [{"name": "刻版", "desc": "手工镂刻桐油纸版"}, {"name": "刮浆", "desc": "豆粉石灰浆通过花版刮印"}, {"name": "染蓝", "desc": "靛蓝染料反复浸染氧化"}],
     "inheritors": [{"name": "吴元新", "title": "国家级传承人"}],
     "cultural_meaning": "蓝印花布的蓝白之美体现了中国传统造物思想中的朴素与自然。", "images": ["/static/knowledge/nantonglan_1.jpg"]},

    # === 竹编类 (新增) ===
    {"name": "东阳竹编", "category": "竹编", "region": "浙江东阳", "era": "宋",
     "description": "东阳竹编以水竹为材，劈篾细如发丝，编织精密，可编出各种造型的器皿和工艺品，与东阳木雕齐名。",
     "techniques": [{"name": "劈篾", "desc": "将竹片劈成极细的篾丝"}, {"name": "编织", "desc": "多种编织纹样组合"}, {"name": "造型", "desc": "立体竹编造型技法"}],
     "inheritors": [{"name": "何福礼", "title": "国家级传承人"}],
     "cultural_meaning": "竹编艺术体现了中国'以竹为器'的生活智慧，竹子象征君子品格。", "images": ["/static/knowledge/dongyangzhubian_1.jpg"]},
    {"name": "自贡龚扇", "category": "竹编", "region": "四川自贡", "era": "清",
     "description": "龚扇又称竹丝扇，以极细竹丝编织成扇面，薄如蝉翼、光泽如绢，被誉为'中华第一扇'。",
     "techniques": [{"name": "劈丝", "desc": "将竹片劈成0.01mm细丝"}, {"name": "编织", "desc": "经纬交织形成图案"}, {"name": "装裱", "desc": "扇面与扇骨精工装配"}],
     "inheritors": [{"name": "龚道勇", "title": "国家级传承人"}],
     "cultural_meaning": "龚扇将实用与艺术完美融合，是川南竹文化的极致表达。", "images": ["/static/knowledge/gongshan_1.jpg"]},

    # === 书法篆刻类 (新增) ===
    {"name": "中国书法", "category": "书法", "region": "全国", "era": "历代",
     "description": "中国书法是以汉字为载体的独特视觉艺术，历经篆、隶、楷、行、草五大书体的演变，是人类非物质文化遗产代表作。",
     "techniques": [{"name": "笔法", "desc": "执笔运笔的技法体系"}, {"name": "墨法", "desc": "浓淡干湿的用墨技巧"}, {"name": "章法", "desc": "字间行间的布局艺术"}],
     "inheritors": [{"name": "启功", "title": "著名书法家"}, {"name": "沈鹏", "title": "中国书协名誉主席"}],
     "cultural_meaning": "书法是中国文化的核心艺术形式，'书画同源'体现了中国艺术独特的审美体系。", "images": ["/static/knowledge/shufa_1.jpg"]},
    {"name": "篆刻", "category": "篆刻", "region": "全国", "era": "历代",
     "description": "篆刻是以篆书入印的镌刻艺术，融合书法、章法、刀法为一体，方寸之间见乾坤。2009年入选人类非物质文化遗产。",
     "techniques": [{"name": "冲刀", "desc": "刀锋直冲，线条劲挺"}, {"name": "切刀", "desc": "逐刀切入，线条古朴"}, {"name": "边款", "desc": "印侧刻字题跋"}],
     "inheritors": [{"name": "韩天衡", "title": "西泠印社副社长"}],
     "cultural_meaning": "篆刻体现了中国'金石气'的审美传统，印章自古以来就是权力与信用的象征。", "images": ["/static/knowledge/zhuanke_1.jpg"]},

    # === 泥塑类 (新增) ===
    {"name": "天津泥人张", "category": "泥塑", "region": "天津", "era": "清",
     "description": "'泥人张'彩塑始于清代道光年间，创始人张明山，至今已传六代。作品人物栩栩如生，色彩明快雅致，是北方泥塑的代表。",
     "techniques": [{"name": "捏塑", "desc": "直接以手捏制成型"}, {"name": "彩绘", "desc": "矿物颜料多层着色"}, {"name": "烧制", "desc": "低温烧制定型"}],
     "inheritors": [{"name": "张宇", "title": "第六代传人"}],
     "cultural_meaning": "泥人张将民间泥塑提升到了雕塑艺术的高度，是天津最具代表性的文化符号。", "images": ["/static/knowledge/nirenzhang_1.jpg"]},
    {"name": "惠山泥人", "category": "泥塑", "region": "江苏无锡", "era": "明",
     "description": "惠山泥人以惠山黑泥为原料，代表作品'大阿福'憨态可掬。分为'粗货'(耍货)和'细货'(手捏戏文)两大类。",
     "techniques": [{"name": "印坯", "desc": "模具印制大体形态"}, {"name": "手捏", "desc": "手工精细塑造细节"}, {"name": "彩绘", "desc": "勾线填彩完成装饰"}],
     "inheritors": [{"name": "喻湘涟", "title": "国家级传承人"}],
     "cultural_meaning": "大阿福形象承载着江南人民对幸福生活的向往，是吴地文化的重要符号。", "images": ["/static/knowledge/huishanniren_1.jpg"]},

    # === 戏曲相关类 (新增) ===
    {"name": "昆曲", "category": "戏曲", "region": "江苏昆山", "era": "元明",
     "description": "昆曲是中国最古老的剧种之一，被联合国教科文组织列为首批'人类口述和非物质遗产代表作'。唱腔婉转、表演细腻。",
     "techniques": [{"name": "水磨腔", "desc": "柔美婉转的唱腔技法"}, {"name": "折扇功", "desc": "以扇为道具的身段表演"}, {"name": "水袖功", "desc": "长袖善舞的表演技巧"}],
     "inheritors": [{"name": "蔡正仁", "title": "国家级传承人"}, {"name": "张静娴", "title": "国家级传承人"}],
     "cultural_meaning": "昆曲被誉为'百戏之祖'，对中国戏曲发展产生了深远影响，代表了中国古典戏剧的最高成就。", "images": ["/static/knowledge/kunqu_1.jpg"]},
    {"name": "京剧脸谱绘制", "category": "戏曲", "region": "北京", "era": "清",
     "description": "京剧脸谱是中国戏曲独有的化妆艺术，以夸张的色彩和图案表现人物性格。红忠紫孝、黑正粉老、黄狠灰贪、蓝勇绿暴。",
     "techniques": [{"name": "勾脸", "desc": "以毛笔蘸色勾画面部图案"}, {"name": "揉脸", "desc": "以手揉色打底"}, {"name": "抹脸", "desc": "以笔抹色形成大块面"}],
     "inheritors": [{"name": "颜少奎", "title": "脸谱艺术传承人"}],
     "cultural_meaning": "京剧脸谱是中国戏曲美学的核心元素，其色彩象征体系是中华文化独特的视觉语言。", "images": ["/static/knowledge/lianpu_1.jpg"]},

    # === 民间美术类 (新增) ===
    {"name": "潍坊风筝", "category": "民间美术", "region": "山东潍坊", "era": "明清",
     "description": "潍坊风筝兴于明代，以竹为骨、绢为面，造型多样、彩绘精美，放飞性能优良。潍坊国际风筝节是世界知名的文化盛会。",
     "techniques": [{"name": "扎制", "desc": "选竹劈条扎制骨架"}, {"name": "裱糊", "desc": "丝绢或纸裱在骨架上"}, {"name": "彩绘", "desc": "工笔重彩绘制图案"}],
     "inheritors": [{"name": "张效东", "title": "国家级传承人"}],
     "cultural_meaning": "风筝是中国人'放飞梦想'的文化象征，体现了民间智慧与美学创造的完美结合。", "images": ["/static/knowledge/weifangfengzheng_1.jpg"]},
    {"name": "内画鼻烟壶", "category": "民间美术", "region": "河北衡水", "era": "清",
     "description": "内画鼻烟壶是在透明壶内壁反手作画的绝技，以特制弯笔伸入壶口书画，方寸之间绘出大千世界。",
     "techniques": [{"name": "内画", "desc": "壶内反手作画"}, {"name": "磨砂", "desc": "壶内壁磨砂以便着色"}],
     "inheritors": [{"name": "王习三", "title": "国家级传承人"}],
     "cultural_meaning": "内画鼻烟壶将中国传统书画艺术浓缩于方寸之间，是极致工艺与文人审美的结晶。", "images": ["/static/knowledge/neihua_1.jpg"]},

    # === 唐三彩类 (补充) ===
    {"name": "唐三彩烧制", "category": "唐三彩", "region": "河南洛阳", "era": "唐",
     "description": "唐三彩是唐代彩色釉陶的总称，以黄、绿、白三色为主，造型涵盖人物、动物、器皿，是盛唐气象的视觉见证。",
     "techniques": [{"name": "素烧", "desc": "泥坯先低温素烧"}, {"name": "施釉", "desc": "多种色釉交错施于器表"}, {"name": "釉烧", "desc": "高温下釉色流动交融"}],
     "inheritors": [{"name": "高水旺", "title": "国家级传承人"}],
     "cultural_meaning": "唐三彩再现了丝绸之路上的胡汉交流盛况，是大唐开放包容精神的物质体现。", "images": ["/static/knowledge/tangsancai_1.jpg"]},

    # === 紫砂类 (补充) ===
    {"name": "宜兴紫砂陶制作", "category": "紫砂", "region": "江苏宜兴", "era": "明",
     "description": "宜兴紫砂陶以当地独有的紫砂泥为原料，尤以紫砂壶最为著名。透气性好、泡茶不走味，是中国茶文化的核心器具。",
     "techniques": [{"name": "打泥片", "desc": "将泥料拍打成均匀薄片"}, {"name": "围身筒", "desc": "泥片围成壶身"}, {"name": "明针", "desc": "牛角明针精修表面"}],
     "inheritors": [{"name": "徐秀棠", "title": "国家级传承人"}, {"name": "吕尧臣", "title": "国家级传承人"}],
     "cultural_meaning": "紫砂壶将实用与艺术融为一体，代表了中国茶道'和静怡真'的精神追求。", "images": ["/static/knowledge/zishahu_1.jpg"]},
]


def generate_image(name: str, category: str, filepath: Path):
    """生成一张简单的占位图片"""
    W, H = 800, 600

    # 古风配色
    bg = (245, 240, 230)  # 暖米色底
    border = (201, 169, 110)  # 金色边框

    img = Image.new("RGB", (W, H), bg)

    # 绘制边框
    draw = ImageDraw.Draw(img)
    for i in range(4):
        draw.rectangle([i, i, W - 1 - i, H - 1 - i], outline=border)

    # 内框装饰线
    margin = 30
    draw.rectangle([margin, margin, W - margin, H - margin], outline=border, width=2)

    # 中间饰带
    draw.rectangle([margin + 10, H // 3, W - margin - 10, H // 3 + 3], fill=border)
    draw.rectangle([margin + 10, 2 * H // 3, W - margin - 10, 2 * H // 3 + 3], fill=border)

    # 使用默认字体
    try:
        # 尝试加载中文字体
        font_paths = [
            "C:/Windows/Fonts/simhei.ttf",
            "C:/Windows/Fonts/msyh.ttc",
            "C:/Windows/Fonts/simsun.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
            "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        ]
        title_font = None
        cat_font = None
        for fp in font_paths:
            if os.path.exists(fp):
                title_font = ImageFont.truetype(fp, 60)
                cat_font = ImageFont.truetype(fp, 36)
                break

        if title_font is None:
            title_font = ImageFont.load_default()
            cat_font = ImageFont.load_default()
    except Exception:
        title_font = ImageFont.load_default()
        cat_font = ImageFont.load_default()

    # 绘制标题（居中）
    title = name
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, H // 3 + 25), title, fill=(65, 45, 35), font=title_font)

    # 绘制分类
    cat_text = f"—— {category} ——"
    bbox = draw.textbbox((0, 0), cat_text, font=cat_font)
    cw = bbox[2] - bbox[0]
    draw.text(((W - cw) // 2, 2 * H // 3 + 25), cat_text, fill=(150, 120, 90), font=cat_font)

    # 底部署名
    footer = "非物质文化遗产"
    draw.text((W - 250, H - 50), footer, fill=(180, 160, 140), font=cat_font)

    # 保存
    filepath.parent.mkdir(parents=True, exist_ok=True)
    img.save(filepath, "JPEG", quality=85)
    print(f"  生成占位图: {filepath.name}")


def main():
    print("=" * 50)
    print("非遗占位图片生成 & 数据扩展脚本")
    print("=" * 50)

    # 1. 生成占位图片
    print("\n[1/3] 生成占位图片...")
    # 从原始种子数据生成
    with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
        original_data = json.load(f)

    all_items = original_data + EXTRA_HERITAGE

    for item in all_items:
        for img_path in item.get("images", []):
            filename = Path(img_path).name
            filepath = KNOWLEDGE_DIR / filename
            if not filepath.exists():
                generate_image(item["name"], item["category"], filepath)

    print(f"  共处理 {len(all_items)} 条记录")

    # 2. 更新种子数据文件
    print("\n[2/3] 更新种子数据文件...")
    with open(HERITAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)
    print(f"  已写入 {len(all_items)} 条非遗数据到 {HERITAGE_FILE}")

    # 3. 重新播种数据库
    print("\n[3/3] 重新播种数据库...")
    os.environ.setdefault("DATABASE_URL", DB_URL)

    from app.models.database import SessionLocal, init_db
    from app.models.exhibition import HeritageItem

    init_db()
    db = SessionLocal()

    try:
        # 清除旧数据
        count = db.query(HeritageItem).count()
        if count > 0:
            print(f"  清除旧数据 ({count} 条)...")
            db.query(HeritageItem).delete()
            db.commit()

        # 插入新数据
        imported = 0
        for item in all_items:
            heritage = HeritageItem(
                name=item["name"],
                category=item["category"],
                region=item["region"],
                era=item["era"],
                description=item["description"],
                techniques_json=json.dumps(item["techniques"], ensure_ascii=False),
                inheritors_json=json.dumps(item["inheritors"], ensure_ascii=False),
                images_json=json.dumps(item["images"], ensure_ascii=False),
                cultural_meaning=item["cultural_meaning"],
            )
            db.add(heritage)
            imported += 1

        db.commit()
        print(f"  导入完成: {imported} 条非遗数据")
    except Exception as e:
        db.rollback()
        print(f"  错误: {e}")
        raise
    finally:
        db.close()

    print("\n" + "=" * 50)
    print(f"完成！展厅现有 {imported} 件非遗藏品")
    print(f"占位图片存放位置: {KNOWLEDGE_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    main()
