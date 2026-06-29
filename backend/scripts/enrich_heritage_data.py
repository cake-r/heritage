"""Enrich heritage seed data with detailed descriptions, cultural meanings, and inheritor bios.

Usage:
    python scripts/enrich_heritage_data.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
HERITAGE_FILE = Path(__file__).resolve().parent.parent / "data" / "knowledge" / "heritage_sample.json"

# Extended descriptions for key items
EXTENDED_DESCRIPTIONS = {
    "苏绣": (
        "苏绣，发源于苏州吴县一带，是中国四大名绣之首，至今已有2500余年历史。三国时期已有刺绣记载，"
        "宋代设绣局管理，明清时期达到鼎盛，成为宫廷贡品。苏绣以'精、细、雅、洁'著称于世，其针法多达40余种，"
        "尤以平针绣最见功力。绣品色彩和谐、线条明快、针法活泼，能以线代笔，绣出如同绘画般的效果。"
        "代表作品有双面绣《猫》《金鱼》等，正反两面皆可见栩栩如生之态，令人叹为观止。"
        "2006年，苏绣被列入第一批国家级非物质文化遗产名录。"
    ),
    "景德镇手工制瓷": (
        "景德镇手工制瓷技艺始于汉代，兴于宋代景德年间（1004-1007年），因其瓷器质地精美而被赐以皇帝年号得名。"
        "元代在此设立'浮梁瓷局'，成为全国制瓷中心；明清两代设御窑厂，专为皇室烧造瓷器。"
        "景德镇制瓷以'白如玉、明如镜、薄如纸、声如磬'闻名世界，其核心工艺流程包括："
        "采石制泥、淘炼泥土、拉坯成型、利坯修整、画坯施釉、满窑烧成等72道工序。"
        "青花、粉彩、玲珑、颜色釉并称景德镇四大名瓷，每种都有独特的配方和烧制工艺。"
        "景德镇瓷器通过海上丝绸之路远销欧亚非各国，深刻影响了世界陶瓷发展历程。"
    ),
    "剪纸": (
        "剪纸是中国最古老、流传最广的民间艺术之一，以剪刀或刻刀在纸上剪刻花纹，用于窗花、门笺、墙花、灯花等装饰。"
        "其起源可追溯至汉代纸的发明，唐代已盛行，宋代出现了专业剪纸艺人。"
        "剪纸分为南派和北派两大风格：北派以陕西、山西、河北为代表，风格粗犷豪放、线条简洁有力；"
        "南派以江苏、浙江、广东为代表，风格纤细秀丽、玲珑剔透。技法上分为阴刻（刻去线条保留块面）和阳刻（保留线条刻去块面），"
        "以及套色剪纸、染色剪纸等多种形式。2009年，中国剪纸被联合国教科文组织列入人类非物质文化遗产代表作名录。"
    ),
    "皮影戏": (
        "皮影戏又称'影子戏'或'灯影戏'，是中国最古老的戏曲形式之一，始于西汉，兴于唐宋，盛于明清。"
        "表演时，艺人在白色幕布后面操纵用兽皮或纸板制成的影人，借助灯光照射使影人形象投射于幕布之上，"
        "配合当地流行的曲调唱述故事，同时配以打击乐器和弦乐，有浓厚的乡土气息。"
        "皮影制作需经过选皮、制皮、画稿、雕镂、敷彩、熨平、缀结等20余道工序。"
        "各地皮影风格各异：陕西华县皮影古朴大气，河北滦州皮影精细灵巧，湖南皮影色彩艳丽。"
        "2011年，中国皮影戏入选联合国教科文组织人类非物质文化遗产代表作名录。"
    ),
    "南京云锦": (
        "南京云锦因'灿若云霞'得名，与成都蜀锦、苏州宋锦并称中国三大名锦，且位居首位。"
        "云锦始于东晋，盛于元明清三代，是专为皇室织造的御用贡品，织造工艺极为复杂。"
        "云锦的主要品种有妆花、织金、库缎、织锦四大类，其中'妆花'工艺最为精湛，"
        "能在一件织物上配织数十种彩色纬线，织出色彩斑斓、金碧辉煌的效果。"
        "云锦织机为传统大花楼木织机，长5.6米、高4米，需拽花工和织手两人上下配合操作，"
        "一天仅能织出5-6厘米，故有'寸锦寸金'之说。2009年，南京云锦织造技艺入选人类非物质文化遗产代表作名录。"
    ),
    "唐三彩": (
        "唐三彩是盛行于唐代的彩色釉陶总称，以黄、绿、白（或褐、蓝、黑）三种主色调著称，"
        "实际上'三'在古汉语中意'多'，唐三彩不止三种颜色。其制作工艺是在素烧的陶坯上施以含铁、铜、钴、锰等"
        "金属氧化物的彩釉，经800°C左右的温度烧制，釉色在高温下自然流动交融，形成斑驳绚丽的独特效果。"
        "唐三彩造型极为丰富，有人物俑（仕女、胡人、武士）、动物俑（马、骆驼、镇墓兽）以及各种生活器皿，"
        "生动再现了盛唐时期的社会风貌和丝绸之路上的中外文化交流景象。洛阳是唐三彩的主要出土地。"
        "2008年，唐三彩烧制技艺入选国家级非物质文化遗产名录。"
    ),
}

# Extended cultural meanings
EXTENDED_MEANINGS = {
    "苏绣": (
        "苏绣承载着江南水乡两千余年的审美理想与生活智慧。一针一线之间不仅凝结着绣娘的心血与时光，"
        "更寄托了中国人对精致生活的向往。苏绣作品中反复出现的吉祥图案——蝙蝠（福）、梅花（美）、"
        "鲤鱼（余）——构成了中国民间吉祥文化的完整符号体系。作为'海上丝绸之路'的重要贸易品，"
        "苏绣将中华审美传播至五洲四海，至今仍是国家外交馈赠的首选礼品，堪称'流动的中国文化名片'。"
    ),
    "剪纸": (
        "剪纸是中国民间'以刀代笔、以纸为媒'的独特造型艺术。大红剪纸是中国年味的第一视觉符号，"
        "每逢春节，家家户户贴上窗花，祈愿新岁吉祥安康——这是中国人'以红求吉、以形寓福'传统的生动体现。"
        "剪纸中的阴阳相生、虚实相映，暗合了中国哲学'阴阳和合'的宇宙观。它无需昂贵的材料与复杂的工具，"
        "一把剪刀一张纸，就能将劳动人民对美好生活的全部想象化为可视的艺术，是真正'从泥土中生长出来的美'。"
    ),
    "景德镇手工制瓷": (
        "景德镇千年窑火不灭，是中国'工匠精神'最经典的注脚。'共计一坯之力，过手七十二，方克成器'——"
        "每一件瓷器都经历了72道工序的千锤百炼，这种对完美的极致追求，正是中华文明'道器合一'思想的体现。"
        "景德镇瓷器不仅是实用器皿，更是承载中国文化走向世界的'白色黄金'。从宋真宗赐名到郑和下西洋携带大量瓷器，"
        "景德镇见证了中国与世界文明对话的辉煌历程，'China'（瓷器）与'china'（中国）的重名并非巧合。"
    ),
    "皮影戏": (
        "皮影戏是'一口叙说千古事，双手对舞百万兵'的民间戏剧奇观。方寸白幕之后，小小的影人演绎着帝王将相、"
        "才子佳人的悲欢离合，将历史、道德、信仰通过生动的光影传递给千家万户。皮影戏集绘画、雕刻、音乐、"
        "文学、表演于一体，是中国民间艺术的集大成者。它的'借光显影'原理被认为是电影艺术的最早雏形，"
        "对世界影像艺术的发展产生了深远影响。每一个皮影艺人都是'活着的博物馆'。"
    ),
    "南京云锦": (
        "云锦是中华织造技艺的巅峰之作，'寸锦寸金'的背后是千年皇室的审美标准与技术追求。"
        "云锦织机上的每一根金线、每一道彩纬，都记录着中国古代纺织科技的高度发达。"
        "云锦纹样中的龙凤、云气、江崖海水等元素构成了完整的皇家符号体系，是研究中国古代礼制、"
        "服饰制度和等级秩序的重要物质资料。云锦不仅是织物，更是'用金线织成的中国服饰史'。"
    ),
}

# Extended inheritor descriptions
INHERITOR_DETAILS = {
    "苏绣": [
        {"name": "姚建萍", "title": "国家级传承人", "desc": "中国工艺美术大师，国家级非遗苏绣代表性传承人。从事苏绣创作40余年，作品多次作为国礼赠予外国元首。她开创性地将西方油画的光影技法融入传统苏绣，代表作《仕女图》被大英博物馆收藏。"},
        {"name": "张玉英", "title": "省级传承人", "desc": "苏州镇湖刺绣协会副会长，擅长双面三异绣（异色、异样、异针），能在同一块底料上绣出正反不同的精美图案。培养了近百名刺绣传人。"},
    ],
    "剪纸": [
        {"name": "吕胜中", "title": "国家级传承人", "desc": "中央美术学院教授，将传统剪纸与现代艺术观念融合，创立了独特的'小红人'艺术符号体系。作品曾参加威尼斯双年展，推动中国剪纸走向国际当代艺术舞台。"},
        {"name": "王老赏", "title": "省级传承人", "desc": "陕西安塞剪纸代表人物，自幼跟随祖母学习剪纸，擅长即兴创作，无需画稿可直接下剪。其作品线条粗犷有力，充满黄土高原的生命张力。"},
    ],
    "景德镇手工制瓷": [
        {"name": "王锡良", "title": "国家级传承人", "desc": "中国工艺美术大师，景德镇陶瓷美术界泰斗。12岁从艺，精于釉上彩绘，开创了'王氏粉彩'新风格。作品被故宫博物院、中国国家博物馆等收藏。从艺80余年，桃李满天下。"},
        {"name": "黄云鹏", "title": "国家级传承人", "desc": "景德镇国际陶瓷文化交流中心会长，著名古陶瓷仿制专家。1979年起研究复制元明清御窑瓷器，成功复原了失传数百年的元青花、明成化斗彩等古代名瓷的配方和烧制工艺。"},
    ],
    "皮影戏": [
        {"name": "汪天稳", "title": "国家级传承人", "desc": "陕西华县皮影雕刻大师，12岁拜师学艺，从艺60余年。独创'推皮走刀'雕刻技法，刀法精准如外科手术。曾为张艺谋电影《活着》制作全部皮影道具，被誉为'中国皮影雕刻第一刀'。"},
        {"name": "刘立新", "title": "省级传承人", "desc": "河北滦州皮影第五代传人，精通皮影戏'拿、贴、打、拉、唱'五项全艺。坚持传统皮影戏巡演40余年，累计演出超过5000场。"},
    ],
    "南京云锦": [
        {"name": "周双喜", "title": "国家级传承人", "desc": "南京云锦研究所高级工艺美术师，从事云锦研究复制工作40余年。主持完成了明代万历皇帝龙袍、清代乾隆皇帝朝服等珍贵文物的复制工程。精通云锦'挑花结本'这一核心绝技。"},
    ],
    "唐三彩": [
        {"name": "高水旺", "title": "国家级传承人", "desc": "洛阳唐三彩仿古艺术研究院院长，从事唐三彩研究仿制40余年。成功破解了唐三彩釉料配方和烧成曲线，复原了失传千年的盛唐釉陶工艺。作品多次被作为国礼赠送。"},
    ],
}


def enrich():
    with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    enriched_count = 0
    for item in items:
        name = item["name"]

        # Enrich description
        if name in EXTENDED_DESCRIPTIONS and len(item.get("description", "")) < 200:
            item["description"] = EXTENDED_DESCRIPTIONS[name]
            enriched_count += 1

        # Enrich cultural meaning
        if name in EXTENDED_MEANINGS and len(item.get("cultural_meaning", "")) < 200:
            item["cultural_meaning"] = EXTENDED_MEANINGS[name]
            enriched_count += 1

        # Enrich inheritor details
        if name in INHERITOR_DETAILS:
            item["inheritors"] = INHERITOR_DETAILS[name]
            enriched_count += 1

    with open(HERITAGE_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Enriched {enriched_count} fields across {len(items)} items")
    return items


def reseed(items):
    """Re-seed the database with enriched data"""
    from app.models.database import SessionLocal, init_db
    from app.models.exhibition import HeritageItem

    init_db()
    db = SessionLocal()
    try:
        count = db.query(HeritageItem).count()
        print(f"  Clearing {count} existing records...")
        db.query(HeritageItem).delete()
        db.commit()

        for item in items:
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

        db.commit()
        print(f"  Imported {len(items)} enriched items")
    except Exception as e:
        db.rollback()
        print(f"  Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("Heritage Data Enrichment")
    print("=" * 50)
    items = enrich()
    print("Re-seeding database...")
    reseed(items)
    print("Done!")
