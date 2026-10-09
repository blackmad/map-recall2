import runpy,json,re,html,concurrent.futures,pathlib
m=runpy.run_path('scripts/landmarks/nieuwendammerkerk-acquire.py');fetch=m['fetch'];ROOT=m['ROOT']
urls={'3dbag.json':'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012144206','vbo.json':'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items/6f71af61-905a-5c49-91a2-76b5a0993b6d','operator-header.png':'https://www.nieuwendammerkerk.nl/wp-content/uploads/2019/05/header02.png','operator-2019-side.jpg':'https://www.nieuwendammerkerk.nl/wp-content/uploads/2019/09/IMG_0213-1.jpg','operator-2019-context.jpg':'https://www.nieuwendammerkerk.nl/wp-content/uploads/2019/09/IMG_1387.jpg'}
files=['Brede_Kerkepad_8.JPG','Nieuwendammerkerk.JPG','Toren_van_de_Nieuwendammerkerk.jpg','Van_achteren_-_Nieuwendam_-_20164232_-_RCE.jpg','Kerk_met_rondbogen_in_rode_en_gele_baksteen_en_toren_van_twee_geledingen_met_naaldspits_-_Amsterdam_-_20409474_-_RCE.jpg','Jacobus_van_Eck,_Afb_A01634000708.jpg']
def photo(f):
 name='commons-'+f;page=fetch(name+'.html','https://commons.wikimedia.org/wiki/File:'+f)
 matches=re.findall(r'<div class="fullImageLink".*?href="([^"]+)"',page.decode(),re.S)
 if matches: print(name,len(fetch(name,html.unescape(matches[0]))))
 else:print('NO IMAGE',f)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 list(pool.map(lambda q:fetch(*q),urls.items()));list(pool.map(photo,files))
print('3dbag',len((ROOT/'raw/3dbag.json').read_bytes()))
