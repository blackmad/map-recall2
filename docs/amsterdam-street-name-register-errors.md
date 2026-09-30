# Errors in Amsterdam's street-name register (`beschrijvingNaam`)

Found while retranslating the street-name origins, 2026-09-30. Every entry
links to the live record in the municipal BAG API
(`https://api.data.amsterdam.nl/v1/bag/openbareruimtes/<id>/`), the source
of `public/data/extracts/amsterdam/staging/street-name-origins.json`.

The list grows as the retranslation proceeds; so far it covers the names
from 's-Gravelandse Veer to Nicolaas Tetterodestraat, plus a register-wide scan for
texts that start or stop mid-sentence.

How the game handles each: **withheld** means no origin card at all
(`WITHHELD_ORIGINS` in `scripts/lib/streetNameOrigins.ts`, checked by
`scripts/check-street-name-origins.ts`); **repaired** means the English is
translated from the corrected text; **kept** means the English follows the
register, error included; **corrected** means the English fixes a clear
factual error; **replaced by a sourced supplement** means the card shows a
short text written from the cited source instead
(`scripts/street-name-origin-supplements.json`, which keeps the URLs).

## 1. Text filed under the wrong name

The pairs sort next to each other, which suggests text that spilled into the
next record.

| Name | BAG id | What is wrong | In the game |
|---|---|---|---|
| Dirk de Waterduikerbrug | [0363300011951530](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951530/) | Text stops mid-sentence: "…een zeer gerespecteerd figuur in". | Repaired: joined with the next row's text. |
| Dirk van Hasseltssteeg | [0363300000003271](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003271/) | Its whole text is the rest of the Waterduikerbrug's: "de Jordaan en hij kreeg diverse medailles…". |  Replaced by a sourced supplement (Wikipedia). |
| Enneüs Heermabrug | [0363300011950195](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950195/) | Only the first sentence: "Deze brug is vernoemd naar Enneüs Heerma (1944-1999)." | Repaired: joined with the next row's text. |
| Enny Vredestraat | [0363300000002843](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002843/) | Its whole text is the rest of Heerma's career: "Hij was voor het CDA wethouder… fractievoorzitter van het CDA in de Tweede Kamer." Enny Vrede's own text is missing. |  Replaced by a sourced supplement (Wikipedia). |
| Hamerstraat | [0363300000003331](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003331/) | "Hij redde … samen met Lau Mazirel en Walter Süskind … oprichters van … Kriterion": part of Piet Meerburg's biography, not the Hamerkanaal street's origin. |  Replaced by a sourced supplement (Wikipedia). |
| Piet Meerburgbrug | [0363300011951254](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951254/) | Complete on its own, but missing the paragraph now under Hamerstraat. | Not yet reached. |
| Eilandsgracht | [0363300011950501](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950501/) | Carries the Elandsgracht's text word for word ("huiden van elanden, herten, beren"): eiland (island) confused with eland (elk). |  Replaced by a sourced supplement (Wikipedia). |
| Elandsgracht | [0363300000002818](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002818/) | Correct, and the source of the Eilandsgracht copy. | Kept. |
| Jaap Kunstbrug | [0363300011951948](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951948/) | Stops after his Java years; the rest of his biography is in the next two records. | Repaired: joined with the next two rows' text. |
| Jaap Nunes Vazstraat | [0363300000003655](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003655/) | Its whole text is the middle of Jaap Kunst's biography ("In 1930 bracht zijn groeiende reputatie…"). | Replaced by a sourced supplement (Wikipedia). |
| Jaap Speyerstraat | [0363300000002395](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002395/) | Its whole text is the last sentence of Jaap Kunst's biography ("En maakte een begin met een van de grootste musicologische collecties in Europa."). | Replaced by a sourced supplement (Wikipedia). |
| Piet Kranenbergpad | [0363300000006028](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000006028/) | Its text is Piet Keizer's Ajax biography, word for word, the same as the Piet Keizerbrug's ([0363300011950122](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950122/)). |  Replaced by a sourced supplement (Wikipedia). |

## 2. Fragments

| Name | BAG id | What is wrong | In the game |
|---|---|---|---|
| Elim | [0363300000002417](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002417/) | The whole text is "tot Park Frankendael". |  Replaced by a sourced supplement (Wikipedia). |
| Piet Wiedijkstraat | [0363300000004367](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004367/) | The whole text is "met name op het gebied van het verkeer." |  Replaced by a sourced supplement (Wikipedia). |
| Kinkerstraat | [0363300000004001](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004001/) | The whole text is "Hij vertaalde werk van Shakespeare en Schiller...", the tail of the Kinkerbrug record ([0363300011950672](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950672/)), and never names Kinker. | Sourced supplement from Wikipedia. |
| Vredenburgerbrug | [0363300011950362](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950362/) | Starts mid-sentence ("katholieke bejaardenhuis Vredenburg werd gebouwd…") and stops mid-sentence ("…waren hier achtereen"). | Not yet reached. |
| Na Druk Gelukbrug | [0363300011950397](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950397/) | Starts mid-sentence, repeats its first clause ("…aan de toenmalige Brug is vernoemd naar…"), and stops at "De naam van deze boerderij refereert". | Replaced by a sourced supplement (nl.wikipedia, Olympisch Kwartier). |
| Jan Poytstraat | [0363300011951814](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951814/) | Carries a stray sentence from another architect's record: "Simon van Woerden (1902-1998) heeft rond 1958 de Bethelkerk ontworpen." | Translated without the stray sentence. |
| Lizzy Ansinghstraat | [0363300000005728](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005728/) | Ends with a spliced-in piece of the Nicolaas Anslijnstraat record ([0363300000003854](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003854/)), register markup included: "Anslijnstraat, Nicolaas Osdorp Rb. 15-4-1959 14: l 6 Onderwijshervormer (1778-1838)…" | Translated without the spliced text. |
| Bastingstraat | [0363300000002489](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002489/) | Starts mid-sentence: "het Mosplein. Voor deze buurt…". Says nothing about Basting. | Earlier translation; to review. |
| Badhuiskade | [0363300003695538](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300003695538/) | Starts mid-sentence: "vroegere badinrichting Obelt, gebouwd 1914…". | Earlier translation; to review. |

## 3. Cut off at the end

| Name | BAG id | Where it stops | In the game |
|---|---|---|---|
| Dokter Meurerlaan | [0363300000003285](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003285/) | "…Amsterdams Medisch Sportkeuringsbureau. M" | Translated without the broken edge. |
| Gerrie Mührenbrug | [0363300011950381](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950381/) | The whole text is "Gerrie (Gerrit) Mühren". | Replaced by a sourced supplement (Wikipedia). |
| Haarlemmersluis | [0363300011950354](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950354/) | "…die de uitvalsweg van Amsterdam naar Haarlem" (no verb). | Translated without the broken edge. |
| Eva Schalkbrug | [0363300011951791](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951791/) | "…21 jaar lang hoofdingeland van het Hoogheemraadschap" (which one is missing). | Translated without the broken edge. |
| Robijnstraat | [0363300000004676](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004676/) | "…gaf de straat bij de aanleg de naam Tweede De" | Translated without the broken edge. |
| Sint Anthoniesluis | [0363300011950601](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950601/) | "…die tot de zeventiende eeuw buiten de stad lag en" | Translated without the broken edge. |
| Bickersgracht (water) | [0363300011950695](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950695/) | "…kregen automatisch de naam van de stichter. Voor het" (the street record, [0363300000002930](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002930/), ends cleanly). | Translated without the broken edge. |
| Hederabrug | [0363300011951351](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951351/) | A stray "Waterland" after the last sentence. | Translated without the broken edge. |
| Mariotteplein | [0363300000004265](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004265/) | Junk appended: "Marisplein, Jacob Oud-Zuid Rb. 26-1-1922 15: m 9". | Translated without the broken edge. |


## 4. Factual errors in the text

Clear errors are corrected in the game's English (the cache entry's
`source` ends in `+corrected`); doubtful ones are kept as the register has
them. The "likely correct" column is general knowledge, not checked against
the municipality's sources.

| Name | BAG id | Register says | Likely correct | In the game |
|---|---|---|---|---|
| Caroline Herschelbrug | [0363300012500688](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300012500688/) | telescopes "van de 17e eeuw" | eighteenth century (she lived 1750–1848) | Corrected |
| Dachstein | [0363300000001425](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001425/) | 1995 metres | 2995 m | Corrected |
| Gran Paradiso | [0363300000005922](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005922/) | "Hoogste berg van Italië" | highest entirely within Italy; Mont Blanc is higher | Corrected ("highest entirely within Italy") |
| George Gershwinlaan | [0363300000000940](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000000940/) | 1898–1990 | 1898–1937 | Corrected |
| Hegelhof | [0363300000003357](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003357/) | 1841–1926 | 1770–1831 | Corrected |
| G.T. Ketjenweg | [0363300000001067](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001067/) | works founded "in 1935", yet production centralised "vanaf 1916" | 1835 | Corrected |
| Groene Ridderhof | [0363300011951434](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951434/) | began the inn around 1631, sold it "rond 1538" | a later year (1638?) | Kept (right year unknown) |
| Ferrarisstraat | [0363300000002871](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002871/) | "Giorgi Ferraris" | Galileo Ferraris | Corrected |
| Dulongstraat | [0363300000002785](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002785/) | "atoomtemperatuur" | atoomwarmte (atomic heat) | Corrected |
| Geerdinkhof | [0363300000005608](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005608/) | Tubbergen "(Gelderland)" | Overijssel | Corrected |
| De Tourton Bruynsstraat | [0363300000003230](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003230/) | "vernietigingskamp Buchenwald" | Buchenwald was a concentration camp, not an extermination camp | Corrected |
| Guggenheimlaan | [0363300000001311](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001311/) | built in 1956 | opened 1959 (construction 1956–59) | Kept (construction did start in 1956) |
| Hudsonhof | [0363300000001097](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001097/) | born 1550; discovered Hudson Bay (1610) "in dienst van de Verenigde Oostindische Compagnie" | born c. 1565; he sailed for the VOC in 1609, the 1610 voyage was English | Corrected |
| Jaap Edenstraat | [0363300000003654](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003654/) | "Van 1896 tot 1914 wereldkampioen schaatsen op de 5000 m" | world skating champion 1893, 1895, 1896; his 5000 m world record of 1894 stood for seventeen years | Corrected |
| James Wattstraat | [0363300000003414](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003414/) | "Engels natuurkundige … uitvinder van de stoommachine" | Scottish engineer who improved the steam engine (Newcomen's engine came first) | Corrected |
| Jan Luijkenstraat | [0363300000003434](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003434/) | 'Het menselijk bedrijf' made "samen met zijn broer Caspar" | Caspar Luyken was his son | Corrected |
| Jan van Goyenkade | [0363300000003452](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003452/) | 1595–1635 | 1596–1656 | Corrected |
| Johann Keplerstraat | [0363300000003499](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003499/) | "Boheems astronoom" | German; he worked in Prague | Corrected |
| Johannes Vermeerplein | [0363300000003512](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003512/) | "voornamelijk landschappen en binnenhuizen" | mainly interiors; only two townscapes, no landscapes | Corrected |
| John Coltranestraat | [0363300000001237](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001237/) | "William John Coltrane" | John William Coltrane | Corrected |
| Joseph Scaligerstraat | [0363300000003932](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003932/) | fled "na de Bartholomeusnacht naar Holland" | he fled to Geneva in 1572 and came to Leiden only in 1593 | Corrected |
| Karveelstraat | [0363300000003971](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003971/) | "Zeilschip uit de negentiende eeuw" | a late-medieval type (Columbus's Niña and Pinta, 1492) | Corrected |
| Kinkerbrug | [0363300011950672](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950672/) | Johannes Kinker (1765-1845) | born 1 January 1764 | Corrected |
| Korte Van Eeghenstraat | [0363300000004094](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004094/) | named after Isabelle Henriette van Eeghen (1913-1996), the opening sentence of the Isa van Eeghenbrug record ([0363300011951445](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951445/)) | Christiaan Pieter van Eeghen (1816-1889), like the Van Eeghenstraat ([0363300000005201](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005201/)); the record itself says the street was named in 1896 | Corrected |
| Le Mairegracht | [0363300000001765](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001765/) | Le Maire named Cape Horn "naar zijn vaderstad Hoorn" | Hoorn was Willem Schouten's home town; Le Maire was from an Amsterdam merchant family, and the two made the discovery together | Corrected |
| Leeuwenhoekstraat | [0363300000004147](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004147/) | "uitvinder van de microscoop" | he built improved single-lens microscopes; the microscope predates him | Corrected |
| Lise Meitnerpad | [0363300011951519](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951519/) | "onderzoek naar kernfusie in uranium" | nuclear fission (kernsplijting) | Corrected |
| Lodewijk Boisotstraat | [0363300000004194](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004194/) | relieved Leiden "in 1572" | the Relief of Leiden was in 1574 | Corrected |
| Lord Kelvinstraat | [0363300000004208](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004208/) | "Engels natuurkundige … ontdekte het element argon" | British (born in Belfast, professor at Glasgow); argon was isolated by Rayleigh and Ramsay in 1894 | Corrected |
| Louvrelaan | [0363300000001309](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001309/) | the collection began with "de kunstschatten van Lodewijk XV" | the royal collection goes back to Francis I and Louis XIV | Corrected |
| Majubastraat | [0363300000004246](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004246/) | "op de grens van Transvaal en Oranje Vrijstaat" | Majuba Hill is in Natal, on the Transvaal border | Corrected |
| Makassarplein | [0363300000001211](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001211/) | "Heet thans Ujung Pandang" | the city was called Ujung Pandang only from 1971 to 1999 and is Makassar again | Corrected |
| Marathonweg | [0363300000004255](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004255/) | "Diomedon bracht dit bericht in snelle loop naar Athene" | tradition names the runner Pheidippides | Corrected |
| Marconistraat | [0363300000004258](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004258/) | Guilielmo Marconi | Guglielmo | Corrected |
| Maritzstraat | [0363300000004267](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004267/) | "Versloeg in 1937 de Matabellen" | 1837 (Maritz died in 1839) | Corrected |
| Mata Harihof | [0363300000002449](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002449/) | "Vanwege haar spionageactiviteiten gericht tegen de Duitsers" | she was convicted by the French of spying for Germany | Corrected |
| Max Planckstraat | [0363300000004289](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004289/) | "hoogleraar te Berlijn en Wenen" | Kiel and Berlin | Corrected |
| Maxwellstraat | [0363300000004290](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004290/) | "De Engelse natuurkundige" | Scottish | Corrected |
| Milovan Djilasstraat | [0363300000000892](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000000892/) | (1911-1997), "secretaris-generaal van de Joegoslavische Communistische Partij" | died 1995, as the Milovan Djilasplein record ([0363300003714180](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300003714180/)) says; Tito, not Djilas, led the party | Corrected |
| Nelson Mandelapark | [0363300000005538](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005538/) | sentenced to life "in 1963" | 12 June 1964, at the end of the Rivonia Trial | Corrected |
| Nicolaas Maesstraat | [0363300000003859](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003859/) | 1632–1693 | born January 1634 | Corrected |

## 5. Misspellings flagged by the register itself

| Name | BAG id | Note |
|---|---|---|
| H. Diesveldsingel | [0363300000001398](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001398/) | The text opens "De naam is foutief gespeld": the man was Diesveldt. |
| Carolina MacGillavrylaan | [0363300000002032](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002032/) | "KNWA" for KNAW. |
| Frank Martinus Arionstraat | [0363300011952045](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011952045/) | "een he kolonisatie" (herkolonisatie). |

## 6. A search-and-replace across the register

Some earlier edit replaced "centrum" or "binnenstad" with the district name
"Amsterdam-Centrum", even where the text means a centre in general. The
English translates the meant word.

| Name | BAG id | Damaged phrase |
|---|---|---|
| Jacob Bontiusplaats | [0363300000002174](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002174/) | Batavia, "het bestuurlijk Amsterdam-Centrum van de voormalige kolonie" |
| VOC-kade | [0363300000002333](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002333/) | "Batavia, het bestuurlijke Amsterdam-Centrum Azië" |
| Slijkstraat | [0363300000004535](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004535/) | "In de Amsterdam-Centrum geven verschillende straatnamen…" |
| Passeerdersgracht | [0363300011950312](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950312/) | "…in de Amsterdam-Centrum werd verboden" (the same text in Passeerdersstraat, Nieuwe Passeerdersstraat and the Eerste and Tweede Passeerdersdwarsstraat) |
