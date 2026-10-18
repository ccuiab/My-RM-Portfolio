"""Identify separate fasteners; complete motors and functional spacers stay intact."""
import re

def is_fastener(record):
    hierarchy=record.get('source_hierarchy',[])
    if any(re.match(r'^(MG4010|MG8010|MG8016|M3508|M2006)',n) for n in hierarchy):return False
    name=record['source_node_name']
    if re.search(r'螺钉|螺栓|螺柱|螺母|screw|nut|washer',name,re.I):return True
    if '垫片' in name and not any(s in name for s in ('对夹','连接','定位','安装')):return True
    if re.search(r'DIN|ISO|^STD_',name,re.I) and not re.search(r'bearing|轴承|齿|belt|滑环|联轴器',name,re.I):return True
    return False
