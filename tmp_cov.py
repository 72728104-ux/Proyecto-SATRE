import xml.etree.ElementTree as ET
t = ET.parse("coverage.xml")
for cls in t.iter("class"):
    lines = [int(l.get("number")) for l in cls.iter("line") if l.get("hits")=="0"]
    if lines:
        print(cls.get("filename"), len(lines), lines)
