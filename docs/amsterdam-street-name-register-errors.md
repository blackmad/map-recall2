# Errors in Amsterdam's street-name register (`beschrijvingNaam`)

Found while retranslating the street-name origins, 2026-09-30. Every entry
links to the live record in the municipal BAG API
(`https://api.data.amsterdam.nl/v1/bag/openbareruimtes/<id>/`), the source
of `public/data/extracts/amsterdam/staging/street-name-origins.json`.

The list grows as the retranslation proceeds; so far it covers the names
from 's-Gravelandse Veer to Hoofddorpplein, plus a register-wide scan for
texts that start or stop mid-sentence.

How the game handles each: **withheld** means no origin card at all
(`WITHHELD_ORIGINS` in `scripts/lib/streetNameOrigins.ts`, checked by
`scripts/check-street-name-origins.ts`); **repaired** means the English is
translated from the corrected text; **kept** means the English follows the
register, error included.

## 1. Text filed under the wrong name

The pairs sort next to each other, which suggests text that spilled into the
next record.

| Name | BAG id | What is wrong | In the game |
|---|---|---|---|
| Dirk de Waterduikerbrug | [0363300011951530](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951530/) | Text stops mid-sentence: "…een zeer gerespecteerd figuur in". | Repaired: joined with the next row's text. |
| Dirk van Hasseltssteeg | [0363300000003271](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003271/) | Its whole text is the rest of the Waterduikerbrug's: "de Jordaan en hij kreeg diverse medailles…". | Withheld. |
| Enneüs Heermabrug | [0363300011950195](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950195/) | Only the first sentence: "Deze brug is vernoemd naar Enneüs Heerma (1944-1999)." | Repaired: joined with the next row's text. |
| Enny Vredestraat | [0363300000002843](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002843/) | Its whole text is the rest of Heerma's career: "Hij was voor het CDA wethouder… fractievoorzitter van het CDA in de Tweede Kamer." Enny Vrede's own text is missing. | Withheld. |
| Hamerstraat | [0363300000003331](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003331/) | "Hij redde … samen met Lau Mazirel en Walter Süskind … oprichters van … Kriterion": part of Piet Meerburg's biography, not the Hamerkanaal street's origin. | Withheld. |
| Piet Meerburgbrug | [0363300011951254](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951254/) | Complete on its own, but missing the paragraph now under Hamerstraat. | Not yet reached. |
| Eilandsgracht | [0363300011950501](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950501/) | Carries the Elandsgracht's text word for word ("huiden van elanden, herten, beren"): eiland (island) confused with eland (elk). | Withheld. |
| Elandsgracht | [0363300000002818](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002818/) | Correct, and the source of the Eilandsgracht copy. | Kept. |
| Piet Kranenbergpad | [0363300000006028](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000006028/) | Its text is Piet Keizer's Ajax biography, word for word, the same as the Piet Keizerbrug's ([0363300011950122](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950122/)). | Withheld (found in an earlier session). |

## 2. Fragments

| Name | BAG id | What is wrong | In the game |
|---|---|---|---|
| Elim | [0363300000002417](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002417/) | The whole text is "tot Park Frankendael". | Withheld. |
| Piet Wiedijkstraat | [0363300000004367](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004367/) | The whole text is "met name op het gebied van het verkeer." | Withheld. |
| Vredenburgerbrug | [0363300011950362](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950362/) | Starts mid-sentence ("katholieke bejaardenhuis Vredenburg werd gebouwd…") and stops mid-sentence ("…waren hier achtereen"). | Not yet reached. |
| Na Druk Gelukbrug | [0363300011950397](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950397/) | Starts mid-sentence, repeats its first clause ("…aan de toenmalige Brug is vernoemd naar…"), and stops at "De naam van deze boerderij refereert". | Not yet reached. |
| Bastingstraat | [0363300000002489](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002489/) | Starts mid-sentence: "het Mosplein. Voor deze buurt…". Says nothing about Basting. | Earlier translation; to review. |
| Badhuiskade | [0363300003695538](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300003695538/) | Starts mid-sentence: "vroegere badinrichting Obelt, gebouwd 1914…". | Earlier translation; to review. |

## 3. Cut off at the end

| Name | BAG id | Where it stops |
|---|---|---|
| Dokter Meurerlaan | [0363300000003285](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003285/) | "…Amsterdams Medisch Sportkeuringsbureau. M" |
| Gerrie Mührenbrug | [0363300011950381](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950381/) | The whole text is "Gerrie (Gerrit) Mühren". |
| Haarlemmersluis | [0363300011950354](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950354/) | "…die de uitvalsweg van Amsterdam naar Haarlem" (no verb). |
| Eva Schalkbrug | [0363300011951791](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951791/) | "…21 jaar lang hoofdingeland van het Hoogheemraadschap" (which one is missing). |
| Robijnstraat | [0363300000004676](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004676/) | "…gaf de straat bij de aanleg de naam Tweede De" |
| Sint Anthoniesluis | [0363300011950601](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950601/) | "…die tot de zeventiende eeuw buiten de stad lag en" |
| Bickersgracht (water) | [0363300011950695](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011950695/) | "…kregen automatisch de naam van de stichter. Voor het" (the street record, [0363300000002930](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002930/), ends cleanly). |
| Hederabrug | [0363300011951351](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951351/) | A stray "Waterland" after the last sentence. |
| Mariotteplein | [0363300000004265](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000004265/) | Junk appended: "Marisplein, Jacob Oud-Zuid Rb. 26-1-1922 15: m 9". |

In the game, cut and fragment texts are translated without the broken edge.

## 4. Factual errors in the text

These are kept in the English, because the game translates and does not
correct. Each is worth checking with the municipality.

| Name | BAG id | Register says | Likely correct |
|---|---|---|---|
| Caroline Herschelbrug | [0363300012500688](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300012500688/) | telescopes "van de 17e eeuw" | eighteenth century (she lived 1750–1848) |
| Dachstein | [0363300000001425](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001425/) | 1995 metres | 2995 m |
| Gran Paradiso | [0363300000005922](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005922/) | "Hoogste berg van Italië" | highest entirely within Italy; Mont Blanc is higher |
| George Gershwinlaan | [0363300000000940](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000000940/) | 1898–1990 | 1898–1937 |
| Hegelhof | [0363300000003357](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003357/) | 1841–1926 | 1770–1831 |
| G.T. Ketjenweg | [0363300000001067](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001067/) | works founded "in 1935", yet production centralised "vanaf 1916" | 1835 |
| Groene Ridderhof | [0363300011951434](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011951434/) | began the inn around 1631, sold it "rond 1538" | a later year (1638?) |
| Ferrarisstraat | [0363300000002871](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002871/) | "Giorgi Ferraris" | Galileo Ferraris |
| Dulongstraat | [0363300000002785](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002785/) | "atoomtemperatuur" | atoomwarmte (atomic heat) (translated as "atomic heat") |
| Geerdinkhof | [0363300000005608](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000005608/) | Tubbergen "(Gelderland)" | Overijssel |
| De Tourton Bruynsstraat | [0363300000003230](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000003230/) | "vernietigingskamp Buchenwald" | Buchenwald was a concentration camp, not an extermination camp |
| Guggenheimlaan | [0363300000001311](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001311/) | built in 1956 | opened 1959 (construction 1956–59) |

## 5. Misspellings flagged by the register itself

| Name | BAG id | Note |
|---|---|---|
| H. Diesveldsingel | [0363300000001398](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000001398/) | The text opens "De naam is foutief gespeld": the man was Diesveldt. |
| Carolina MacGillavrylaan | [0363300000002032](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300000002032/) | "KNWA" for KNAW. |
| Frank Martinus Arionstraat | [0363300011952045](https://api.data.amsterdam.nl/v1/bag/openbareruimtes/0363300011952045/) | "een he kolonisatie" (herkolonisatie). |
