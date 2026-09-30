# Errors in Amsterdam's street-name register (`beschrijvingNaam`)

Found while retranslating the street-name origins, 2026-09-30. Every entry
links to the live record in the municipal BAG API
(`https://api.data.amsterdam.nl/v1/bag/openbareruimtes/<id>/`), the source
of `public/data/extracts/amsterdam/staging/street-name-origins.json`.

The list grows as the retranslation proceeds; so far it covers the names
from 's-Gravelandse Veer to Zeelandstraat, plus a register-wide scan for
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
| Hamerstraat | [0363300000003331](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003331/) | "Hij redde … samen met Lau Mazirel en Walter Süskind … oprichters van … Kriterion": part of Piet Meerburg's biography, not the Hamerkanaal street's origin. | Replaced by a sourced supplement (Wikipedia); the paragraph is restored to the Piet Meerburgbrug's card. |
| Piet Meerburgbrug | [0363300011951254](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951254/) | Complete on its own, but missing the paragraph now under Hamerstraat. | Not yet reached. |
| Eilandsgracht | [0363300011950501](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950501/) | Carries the Elandsgracht's text word for word ("huiden van elanden, herten, beren"): eiland (island) confused with eland (elk). |  Replaced by a sourced supplement (Wikipedia). |
| Elandsgracht | [0363300000002818](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002818/) | Correct, and the source of the Eilandsgracht copy. | Kept. |
| Jaap Kunstbrug | [0363300011951948](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951948/) | Stops after his Java years; the rest of his biography is in the next two records. | Repaired: joined with the next two rows' text. |
| Jaap Nunes Vazstraat | [0363300000003655](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003655/) | Its whole text is the middle of Jaap Kunst's biography ("In 1930 bracht zijn groeiende reputatie…"). | Replaced by a sourced supplement (Wikipedia). |
| Jaap Speyerstraat | [0363300000002395](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002395/) | Its whole text is the last sentence of Jaap Kunst's biography ("En maakte een begin met een van de grootste musicologische collecties in Europa."). | Replaced by a sourced supplement (Wikipedia). |
| Piet Kranenbergpad | [0363300000006028](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000006028/) | Its text is Piet Keizer's Ajax biography, word for word, the same as the Piet Keizerbrug's ([0363300011950122](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950122/)). |  Replaced by a sourced supplement (Wikipedia). |
| Nieuwendammerkade | [0363300000003871](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003871/) | Carries the Nieuwendijk's explanation ("Vermoedelijk dankt de Nieuwendijk zijn naam…"), a street in the city centre, not this quay in Noord. | Uses the Nieuwendammerdijk record's explanation of Nieuwendam ([0363300000003870](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003870/)). |
| Rembrandtpark | [0363300000001738](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001738/) | After the first sentence, explains how the Rembrandtplein got its name (the statue of 1852/1875, the Botermarkt), not the park in West. | Kept only the opening sentence about Rembrandt. |
| Scharwouderstraat | [0363300000004473](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004473/) | "Deze 'dunne' biersoort werd vroeger op deze ophaalbrug verkocht…", the second half of the Scharrebiersluis's text. | Withheld. |
| Scheepmakerskade | [0363300000004474](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004474/) | "Een onofficiële naam van deze brug is Rapenburgerschutsluis…", a bridge's text, not this quay's. | Withheld. |
| Smallepadsgracht | [0363300011951137](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951137/) | The Smalschipstraat's text about the smalschip (a Frisian flat-bottomed boat), word for word. The canal on the Realeneiland has nothing to do with it. | Withheld. |
| Smaragdplein | [0363300000004961](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004961/) | The Smederij's text about the ADM shipyard smithy, word for word. | Withheld. |

## 2. Fragments

| Name | BAG id | What is wrong | In the game |
|---|---|---|---|
| Elim | [0363300000002417](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002417/) | The whole text is "tot Park Frankendael". |  Replaced by a sourced supplement (Wikipedia). |
| Piet Wiedijkstraat | [0363300000004367](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004367/) | The whole text is "met name op het gebied van het verkeer." |  Replaced by a sourced supplement (Wikipedia). |
| Kinkerstraat | [0363300000004001](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004001/) | The whole text is "Hij vertaalde werk van Shakespeare en Schiller...", the tail of the Kinkerbrug record ([0363300011950672](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950672/)), and never names Kinker. | Sourced supplement from Wikipedia. |
| Sint Antoniesbreestraat | [0363300000005009](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005009/) | The whole text is "die op zijn beurt zijn naam ontleende aan het Sint Antoniesgasthuis of Leprozenhuis", the tail of a sentence. | Completed from the Sint Antoniesluis's text, which gives the same origin (the Sint Antoniesdijk). |
| Vredenburgerbrug | [0363300011950362](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950362/) | Starts mid-sentence ("katholieke bejaardenhuis Vredenburg werd gebouwd…") and stops mid-sentence ("…waren hier achtereen"). | Completed from the Vredenburgersteeg's text, which is the whole of the same entry. |
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
| Robijnstraat | [0363300000004676](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004676/) | "…gaf de straat bij de aanleg de naam Tweede De" | Translated without the broken edge ("a hard, red gemstone"). |
| Sint Anthoniesluis | [0363300011950601](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950601/) | "…die tot de zeventiende eeuw buiten de stad lag en" | Translated without the broken edge. |
| Bickersgracht (water) | [0363300011950695](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950695/) | "…kregen automatisch de naam van de stichter. Voor het" (the street record, [0363300000002930](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002930/), ends cleanly). | Translated without the broken edge. |
| Hederabrug | [0363300011951351](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951351/) | A stray "Waterland" after the last sentence. | Translated without the broken edge. |
| Mariotteplein | [0363300000004265](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004265/) | Junk appended: "Marisplein, Jacob Oud-Zuid Rb. 26-1-1922 15: m 9". | Translated without the broken edge. |
| Nieuwe Vaart (street) | [0363300011950711](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950711/) | "…gegraven om het IJ en het Oosterdok." | Completed from the Nieuwevaart record ([0363300000003876](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003876/)). |
| Piet Bakkerbrug | [0363300011951476](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951476/) | "…aan wie twee succesvolle films en een musical gewijd zijn. In de omgeving" | Translated without the broken edge. |
| Utrechtsedwarsstraat | [0363300000005178](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005178/) | "Naar de stad Utrecht. is de nieuwe uitvalsroute naar Utrecht…": a sentence about some road's route to Utrecht, spliced in without its subject. | Kept only "After the city of Utrecht". |
| Volewijckbrug | [0363300011951283](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951283/) | Stops mid-sentence: "…waaraan de lijken van misdadigers, die op de Dam waren opgehangen," | Completed with "were displayed", as the Volewijkshof's text says. |
| Wim Suurbierbrug | [0363300011950620](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950620/) | Stops mid-sentence: "…zowel onaantastbaar als toonaangevend" | Completed from the identical Ajax paragraph on the Ruud Krolbrug. |
| VOC-kade | [0363300000002333](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002333/) | "Vanuit Batavia, het bestuurlijke Amsterdam-Centrum Azië": the register-wide replacement of "centrum" (section 6) hit this text too | Translated as "its administrative centre in Asia". |


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
| Nobelweg | [0363300000003883](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003883/) | "uitvinder van het dynamiet en de nitroglycerine"; six prizes "sinds 1901" | nitroglycerine was discovered by Ascanio Sobrero (1847); the economics prize dates from 1969 and is not paid from Nobel's fund | Corrected |
| Okeghemstraat | [0363300000004704](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004704/) | "de leermeester van Dufay en Obrecht" | Dufay (c. 1397–1474) was a generation older; only Obrecht is plausibly his pupil | Corrected |
| Oranje-Vrijstaatkade | [0363300000005939](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005939/) | "De in 1842 gestichte Boeren republiek" | the Orange Free State was founded in 1854 (Bloemfontein Convention) | Corrected |
| Pasteurstraat | [0363300000004337](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004337/) | "Vond een serum tegen hondsdolheid" | a vaccine (1885) | Corrected |
| Philip Vingboonsstraat | [0363300000004358](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004358/) | born 1613; built "onder meer het Trippenhuis" | born c. 1607; the Trippenhuis was designed by his brother Justus Vingboons | Corrected |
| Pieter de Hoochstraat | [0363300000004373](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004373/) | 1639–1684 | baptised 1629, died in or after 1679 | Corrected |
| Pieter van der Werfstraat | [0363300000004384](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004384/) | "het beleg van Leiden in 1572" | 1573–1574 | Corrected |
| Plutostraat | [0363300000004551](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004551/) | "De planeet die het verst van de zon afstaat" | a dwarf planet since 2006 (out of date rather than wrong when written) | Corrected |
| Pradolaan | [0363300000001312](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001312/) | the Prado "geopend in 1918" | opened in 1819 | Corrected |
| Raphaëlplein | [0363300000004618](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004618/) | "Raffaëllo di Senti" | Raffaello Santi (Sanzio) | Corrected |
| Rooseveltlaan | [0363300000004416](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004416/) | president "vanaf 1932" | elected in November 1932, in office from March 1933 | Corrected |
| Rousseaustraat | [0363300000004422](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004422/) | 1711–1778 | born 28 June 1712 | Corrected |
| Rutherfordstraat | [0363300000004437](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004437/) | "Engels natuur- en scheikundige" | born in New Zealand, a British subject | Corrected |
| Sara Burgerhartstraat | [0363300000004458](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004458/) | the novel "uit 1872" | 1782, by Betje Wolff and Aagje Deken (digits transposed) | Corrected |
| Schopenhauerhof | [0363300000004500](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004500/) | 1778–1860 | born 22 February 1788 | Corrected |
| Senefelderstraat | [0363300000004510](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004510/) | "Oostenrijks typograaf" | born in Prague, a German (Bavarian) actor and printer | Corrected |
| Shackletonstraat | [0363300000004513](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004513/) | "Bereikte in 1909 de magnetische zuidpool" | Shackleton led the Nimrod expedition; the pole party was David, Mawson and Mackay. Irish-born | Corrected |
| Silvretta | [0363300000001348](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001348/) | "Bergtop in Zwitserland, 3411 meter hoog" | a range on the Swiss–Austrian border; 3,411 m is its highest peak, Piz Linard | Corrected |
| Snelliusstraat | [0363300000004966](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004966/) | "richtte de eerste Europese sterrenwacht in" | Leiden's observatory was set up in 1633 by Golius, seven years after Snellius's death | Replaced with his law of refraction and triangulation |
| Sontvaarderstraat | [0363300011290589](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011290589/) | "een binnenschip dat vaart tussen Nederland en de Zweedse zuidkust" | a seagoing merchant ship trading through the Sound to the Baltic | Corrected |
| Sophialaan | [0363300000004979](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004979/) | 1817–1877 | born 17 June 1818 | Corrected |
| Spaanse Brabanderstraat | [0363300000004980](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004980/) | "de roman" | a stage comedy | Corrected |
| Spitsbergenstraat | [0363300000005778](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005778/) | Barentsz "liet er de nederzetting Smeerenburg bouwen" | Barentsz died in 1597; Smeerenburg dates from 1619 | Corrected |
| Stephensonstraat | [0363300000005042](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005042/) | "uitvinder van de locomotief (1814)" | Trevithick's locomotive ran in 1804; Stephenson's first (Blücher) in 1814 | Corrected |
| Stuyvesantstraat | [0363300000005059](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005059/) | born 1592 | born 1611/12 (nl.wikipedia calls 1592 an old error) | Corrected |
| Suze Robertsonstraat | [0363300000005067](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005067/) | born 1856 | born 17 December 1855 | Corrected |
| Tasmanstraat | [0363300000005077](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005077/) | discovered Tasmania and New Zealand "in 1642 en 1644" | both on the 1642 voyage; the 1644 voyage charted northern Australia | Corrected |
| Tempelhofstraat | [0363300000001655](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001655/) | "de luchthaven van Berlijn" | closed in 2008 | Corrected |
| Teniersstraat | [0363300000005083](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005083/) | founded "de Brusselse Academie" in 1663 | the Antwerp Academy | Corrected |
| Teslastraat | [0363300000001356](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001356/) | "Joegoslavisch ingenieur" | Serbian, born in Croatia (then Austria), American from 1891; Yugoslavia did not exist until 1918 | Corrected |
| Thérèse Schwartzeplein | [0363300000005107](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005107/) | born 1852 | born 20 December 1851 | Corrected |
| Thomas à Kempisstraat | [0363300000005111](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005111/) | Kempen "in het land van Kleef" | Kempen belonged to the Electorate of Cologne | Corrected |
| Tienraaikade | [0363300000005745](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005745/) | "Dorp in de gemeente Mierlo" | Tienray was in Meerlo (later Meerlo-Wanssum, now Horst aan de Maas); Mierlo is in Noord-Brabant | Corrected |
| Titiaanstraat | [0363300000005124](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005124/) | born 1477 | born c. 1488–1490 | Corrected |
| Titus van Rijnstraat | [0363300000006082](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000006082/) | ran the art business with Hendrickje "na Rembrandts dood" | Hendrickje died in 1663 and Titus in 1668, both before Rembrandt; the business dates from 1660 | Corrected |
| Torresstraat | [0363300000005144](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005144/) | Torres "(1728-1779)" | he sailed the strait in 1606 | Corrected |
| Trimurtistraat | [0363300011952041](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011952041/) | the whole text is "Trimur: onafhankelijkheid" | named after S.K. Trimurti (1912–2008), Indonesian independence activist and first labour minister (Centrumeiland's 2019 anti-colonial names; en.wikipedia) | Replaced |
| Tweede Jacob van Campenstraat | [0363300000002580](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002580/) | built "voor prins Frederik Hendrik in 1657 een paleis in Rijswijk" | Frederik Hendrik died in 1647 | Year dropped |
| Valeriusplein | [0363300000005252](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005252/) | died 1626 | died 27 January 1625 | Corrected |
| Van Diemenkade | [0363300000001210](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001210/) | "Samen met Tasman ontdekte hij Nieuw Holland (Australië) en Van Diemensland" | Van Diemen sent Tasman; Australia's coast was already known as New Holland | Corrected |
| Van Effenstraat | [0363300000005202](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005202/) | "de eerste Nederlandse vertaling" of Robinson Crusoe | Van Effen translated from English into French (en.wikipedia) | Corrected |
| Van Musschenbroekstraat | [0363300000005226](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005226/) | "hoogleraar te Londen" | Duisburg, Utrecht and Leiden | Corrected; Leyden jar added |
| Van Reigersbergenstraat | [0363300000005237](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005237/) | died 1643 | died 1653 | Corrected |
| Van Rensselaerstraat | [0363300000005238](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005238/) | 1580–1646 | c. 1586–1643 | Corrected |
| Van Woustraat | [0363300000005247](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005247/) | 1460–1524 | c. 1450–1527 (nl.wikipedia) | Corrected |
| Vancouverstraat | [0363300000005262](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005262/) | 1758–1790 | 1757–1798 (his Pacific voyage was 1791–1795) | Corrected |
| Vasco da Gamastraat | [0363300000005264](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005264/) | "vond in 1497 de zeeweg rond Kaap de Goede Hoop" | Dias rounded the Cape in 1488; Da Gama opened the sea route to India in 1497–1498 | Corrected |
| Vespuccistraat | [0363300000005283](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005283/) | born 1451 | born 9 March 1454 | Corrected |
| Waterlooplein | [0363300000004822](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004822/) | square created "in 1874" | the Houtgracht and Leprozengracht were filled in 1882 (nl.wikipedia) | Corrected |
| Weissenbruchstraat | [0363300000004838](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004838/) | born 1825 | born 19 June 1824 | Corrected |
| Wigbolt Ripperdastraat | [0363300000004871](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004871/) | the siege of Haarlem "van 1672 op 1673" | 1572–1573 | Corrected |
| Willem Schoutenstraat | [0363300000004909](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004909/) | born 1580 | born c. 1567 | Corrected |
| William Boothstraat | [0363300000004916](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004916/) | died 1914 | died 20 August 1912 | Corrected |
| Zacharias Jansestraat | [0363300000004946](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004946/) | "(1580-1620), uitvinder van de verrekijker" | c. 1585 – c. 1632; the invention is disputed (Lipperhey filed the first patent in 1608) | Corrected |

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
