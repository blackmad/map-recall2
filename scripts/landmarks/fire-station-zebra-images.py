exec(open('scripts/landmarks/fire-station-zebra-acquire.py').read().split("urls=")[0])
urls={'current-front.jpg':'https://brandbase.hetbrandweerforum.nl/wp-content/uploads/2022/01/IJdoornlaan-60-te-Amsterdam.jpg','current-side.jpg':'https://brandbase.hetbrandweerforum.nl/wp-content/uploads/2022/01/IJdoornlaan-60-te-Amsterdam-1.jpg','older-front.jpg':'https://brandbase.hetbrandweerforum.nl/wp-content/uploads/2018/05/IJdoornlaan-60-te-Amsterdam.jpg'}
exec(open('scripts/landmarks/fire-station-zebra-acquire.py').read().split('def fetch')[1].split("(root/'urls.json')")[0].join(['def fetch','']))
(root/'image-urls.json').write_text(json.dumps(urls,indent=2))
