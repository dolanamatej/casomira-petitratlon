# Race Timing App – specifikace

Oct 2, 2026 · @Matej

Pojmy používané v tomto dokumentu jsou definované v [CONTEXT.md](CONTEXT.md).

## Cíl a rozsah

Appka měří dvoudílný závod (pramice P550 + kánoe C2) a vyhodnotí kategorie podle součtu časů. Běží v prohlížeči na notebooku, funguje bez internetu a vše zálohuje do Google tabulky. Když appka selže, převezme měření člověk přímo v tabulce (nouzový režim), takže závod kvůli appce nikdy neskončí.

**MVP (musí být hotové do závodu):**

1. Import přihlášených posádek z CSV a ranní registrace s přidělením startovních čísel.
2. Generátor startovky s ruční úpravou a tiskem.
3. Měření: start, cíl, čekačka, oprava času, DNF, posádka navíc.
4. Výsledovka po kategoriích s tiskem.
5. Lokální ukládání a export/import do souboru JSON.
6. Záloha do Google tabulky (surový log + čitelná časovka) a obnova z ní.

**Až po závodě:** automatické stahování cizích událostí naživo, instalace jako PWA, slučování kategorií v UI, hezčí PDF.

Identifikátory v kódu, komentáře a commity budou anglicky. Texty v UI česky.

## Provoz v den závodu

Každá disciplína má jedno stanoviště, kde je start i cíl, a jeden notebook. Stanoviště, registrace a tiskárna jsou nejvýš 15 m od sebe a na místě je mobilní signál. Každý notebook měří celou svou disciplínu sám, takže hodiny obou strojů se nemusí synchronizovat.

Jeden z notebooků je **hlavní**: běží na něm registrace, generování startovky a výsledovka.

1. **Předem:** hlavní notebook načte CSV s přihlášenými posádkami.
2. **Registrace (do 10:00):** u každé posádky, která opravdu přijela, registrátor opíše do appky číslo z fyzické vesty. Appka hlídá jen to, aby se číslo neopakovalo. Při registraci jde opravit údaje posádky (jméno, kormidelník, kategorie).
3. **10:00–10:30:** hlavní notebook vygeneruje startovku jen z registrovaných posádek, obsluha ji případně upraví a vytiskne. Appka odešle posádky a startovku do tabulky a založí list `časovka`. Druhý notebook si data stáhne z tabulky, nebo je načte ze souboru JSON.
4. **Na stanovišti:** obsluha vybere svou disciplínu (P550 nebo C2). Posádky startují po jedné tlačítkem Start, které zapíše skutečný čas stisku. Čas ve startovce je jen orientační.
5. **Při dojetí:** tlačítko Cíl u dané posádky. Na P550 obsluha opíše čekačku z kartičky posádky.
6. **Průběžně:** každá událost se uloží lokálně a odešle do tabulky, jakmile je signál.
7. **Po závodě:** hlavní notebook stáhne události druhé disciplíny (z tabulky, nebo ze souboru) a vygeneruje výsledovku.

## Datový model

Zdrojem pravdy je append-only log událostí; časy a výsledky se z něj vždy jen dopočítají. Díky tomu je záloha jen přidávání řádků a sloučení dvou notebooků je sjednocení logů podle `id`.

**Vstupní CSV** (jeden řádek = jedna přihlášená posádka):

```csv
category,crew_name,helmsman,club
Vlčata,Kladivouni,Krab,Štiky
OPEN,Victoria,Filip,Lososi
```

`category` musí být jedna z: `Žabičky`, `Vlčata`, `Skautky`, `Skauti`, `OPEN`. Import neznámou kategorii odmítne s jasnou hláškou.

**Startovní číslo je jediný identifikátor posádky.** Události odkazují na číslo a podle něj se posádka páruje mezi notebooky. Jakmile pro posádku existuje první událost, číslo už nejde změnit. Přihlášená posádka bez čísla existuje jen na hlavním notebooku a do startovky ani do synchronizace nevstupuje.

| Entita | Pole | Poznámka |
| --- | --- | --- |
| `Crew` | `startNumber`, `category`, `crewName`, `helmsman`, `club`, `plannedStartP5`, `plannedStartC2` | Přihlášená posádka má `startNumber` prázdné. Plánované starty jsou orientační čas ze startovky; posádka navíc je nemá. Posádku navíc lze přidat i během závodu. |
| `Event` | `id` (UUID), `startNumber`, `discipline` (`P5`/`C2`), `type`, `timestamp`, `waitSeconds`, `voidsEventId`, `deviceId`, `createdAt` | Nikdy se nemaže ani nepřepisuje. |

**Typy událostí:** `start`, `finish`, `wait` (čekačka v sekundách, jen P550), `dnf`, `void` (ruší jinou událost).

**Pravidla:**

- Platí poslední nezrušená událost daného typu pro posádku a disciplínu.
- Oprava času je nová událost `start` nebo `finish` s ručně zadaným časem.
- Zrušit jde kteroukoli událost posádky, i starší. DNF se tak vrací stejně jako chybný start.
- Časy se ukládají jako absolutní razítka s přesností na sekundy.

## Generátor startovky

Startovka vzniká až po registraci, jen z posádek se startovním číslem.

**Pořadí:** na P550 se startuje od nejpomalejší kategorie: Žabičky → Vlčata → Skautky → Skauti → OPEN, uvnitř kategorie podle startovního čísla. Pomalé posádky tak jedou dlouhou pramici, dokud je trať prázdná, a závod nekončí čekáním na ně.

**Algoritmus:** každé stanoviště má N slotů po sobě. Posádka ve slotu `i` na pramici dostane na kánoi slot `(i + ceil(N/2)) mod N`. První (pomalejší) polovina jede nejdřív pramici, druhá nejdřív kánoi, a na žádném stanovišti nevzniká díra.

| Parametr | Výchozí hodnota | Odkud |
| --- | --- | --- |
| Začátek závodu | 10:30 | loni |
| Rozestup startů | 8 min | rozhodnutí, viz níže |
| Orientační limit lodí na trati | 4 kánoe, 4 pramice | zadání |
| Min. pauza mezi disciplínami | 30 min | návrh |
| Typická / nejdelší jízda P550 | 31 / 47 min | loni (medián / maximum) |
| Typická / nejdelší jízda C2 | 14 / 22 min | loni (medián / maximum) |

**Rozestup jde nastavit při generování.** Formulář nabídne 8 minut jako doporučení a pro skutečný počet posádek N u zadané hodnoty hned ukáže:

- čas posledního startu (začátek + (N − 1) × rozestup) a odhad konce závodu (poslední start + nejdelší jízda),
- kolik pramic a kánoí bude typicky na trati (typická jízda / rozestup),
- nejkratší pauzu posádky mezi disciplínami (floor(N/2) × rozestup).

N je počet registrovaných posádek. Před registrací (příprava den předem) se počítá s počtem přihlášených, aby šlo rozestup naplánovat dopředu.

Referenční výpočet pro 27 posádek (loňský stav):

| Rozestup | Poslední start | Pramic na trati (typicky) | Pauza mezi disciplínami |
| --- | --- | --- | --- |
| 7 min | 13:32 | ~4,4 | 91–98 min |
| 8 min | 13:58 | ~3,9 | 104–112 min |
| 10 min | 14:50 | ~3,1 | 130–140 min |

Limit 4 lodí na trati je orientační, protože lodí je fyzicky dost. Generátor varuje, jen když typická jízda / rozestup limit překročí nebo když pauza mezi disciplínami vyjde pod minimum. Skutečný stav hlídá ukazatel na obrazovce Měření.

Po vygenerování jde pořadí ručně upravit (prohození posádek, posun času).

**Posádka navíc** vznikne během závodu, třeba po domluvě vedoucích. Obsluha ji přidá přímo na stanovišti a hned ji může odstartovat. Má kategorii (typicky OPEN) a umisťuje se normálně. Plánovaný čas nemá; na obrazovce Měření se zařadí na konec skupiny „čeká“. Startovní číslo jí přidělí organizátoři a obě stanoviště zadají stejné, takže se po sloučení spárují.

## Obrazovky

Appka má šest obrazovek; nejdůležitější je Měření, která musí být ovladatelná ve spěchu a bez rizika omylu.

| Obrazovka | Co umí |
| --- | --- |
| Posádky | Import CSV, kontrola načtených dat, ruční přidání a úprava posádky. |
| Registrace | Seznam přihlášených posádek s vyhledáváním. U každé zadání startovního čísla z vesty a případná oprava údajů. Přehled, kolik posádek je registrováno. |
| Startovka | Nastavení parametrů s náhledem délky závodu, vygenerování, ruční úprava pořadí, tisk po stanovištích. |
| Měření | Volba disciplíny. Seznam posádek v pořadí startovky ve třech skupinách: čeká, na trati (s běžícím časem), dojela. Ukazatel „na trati: X/4“. Velká tlačítka Start a Cíl, na P550 zadání čekačky, oprava času, DNF, přidání posádky navíc. |
| Výsledky | Tabulka po kategoriích, pořadí, časy obou disciplín, tisk. |
| Synchronizace | Stav zálohy (kolik událostí čeká na odeslání), stažení dat z tabulky, export/import JSON, obnova. |

**Pojistky na obrazovce Měření:**

- Cíl jde zapsat jen posádce, která je na trati.
- Tlačítko Zpět vrátí poslední akci. V detailu posádky jde zrušit kteroukoli její starší událost. Obojí vytvoří událost `void`.
- Po stisku Cíl na P550 se u posádky objeví pole pro čekačku (`m:ss`). Prázdné pole znamená 0 a hodnotu jde později opravit.
- Posádka s DNF zmizí ze skupiny „na trati“.
- Ukazatel lodí na trati se při překročení limitu zvýrazní, ale Start nezablokuje.
- Stav zálohy je vidět stále, ne jen na obrazovce Synchronizace.
- Zavření nebo obnovení stránky nic neztratí, běžící časy se dopočítají z uložených startů.

## Výpočet výsledků

Čas P550 je cíl − start − čekačka, čas C2 je cíl − start a celkový čas je součet obou. Pořadí se určuje vzestupně podle celkového času v rámci kategorie.

- Posádka bez dokončené disciplíny (DNF, chybějící čas) je na konci kategorie bez pořadí, se zkratkou místo času.
- Shoda celkového času na sekundu znamená sdílené místo zobrazené jako rozsah: čtyři posádky se stejným časem za první posádkou jsou všechny „2.–5.“, další je „6.“. Bez dalšího kritéria.
- Sloučení kategorií s málo posádkami se v MVP řeší úpravou kategorie u posádek před vygenerováním výsledovky.

**Test správnosti:** loňská data převedená na události musí dát stejné časy a pořadí jako loňská tabulka (například Vlčata: Sedmička 0:34:32, Dobyvatelé Jorsalu 0:37:26, Kladivouni 0:38:36).

## Záloha a přenos mezi stroji

Data jsou na třech místech: v prohlížeči notebooku, v Google tabulce a v exportovaném souboru. Kterékoli z nich stačí k úplné obnově.

**Google tabulka** má tři listy:

- `crews`: jedna posádka na řádek včetně plánovaných startů. Slouží appce, ale je čitelný i pro lidi.
- `events`: surový log událostí, jen pro appku.
- `časovka`: čitelný list pro lidi v rozložení vzoru (`časovka_vzor.xlsx`), bloky po kategoriích v pořadí Žabičky, Vlčata, Skautky, Skauti, OPEN, jeden řádek na posádku, P550 i C2 na jednom řádku, časy jako běžné hodiny `hh:mm:ss`. Sloupce: A kategorie (nadpis bloku), B start. číslo, C oddíl, D posádka, E kormidelník, F–I pramice (start, cíl, čekačka, výsledek), J–L kánoe (start, cíl, výsledek), M celkový čas, N pořadí. Výsledek, celkový čas a pořadí počítají vzorce, takže časovka funguje i bez appky. Hlavní notebook ho založí po vygenerování startovky a v každém bloku nechá několik volných řádků pro posádky navíc.

**Pravidlo pro časovku:** každá appka zapisuje jen sloupce své disciplíny (P550: F–H; C2: J–K) a řádek hledá podle startovního čísla. Do cizích sloupců nesahá. Když člověk převezme jednu disciplínu (nouzový režim), appka druhé disciplíny mu nic nepřepíše. Pokud startovní číslo v časovce chybí (posádka navíc), skript ho zapíše do prvního volného řádku bloku její kategorie.

Appka do tabulky zapisuje přes malý Google Apps Script nasazený jako webová aplikace:

- `POST` přidá řádky (posádky, startovku, události) a aktualizuje buňky časovky. Skript ignoruje událost, jejíž `id` už v listu je, takže opakované odeslání nevadí. Zápis běží pod zámkem (`LockService`), aby si dva notebooky nepřepsaly stejný volný řádek.
- `GET` vrátí surová data pro obnovu nebo stažení cizích událostí.
- Neodeslané události čekají ve frontě v prohlížeči a appka je zkouší odeslat znovu.

**Ověřeno 2. 10. 2026:** volání z prohlížeče funguje bez potíží s CORS, pokud se tělo posílá jako `text/plain` a token je v těle (u `GET` v query), ne v hlavičce. Skript je v `apps-script/Code.gs`.

**Skript je samostatný projekt, ne vložený do tabulky.** Tabulka leží na sdíleném disku přístavu a vlastní ji organizace. Ze skriptu vloženého do takové tabulky nejde nasadit webovou aplikaci („Nemáte oprávnění provést tuto akci“). Samostatný skript ve „Můj disk“ skautského účtu otevírá tabulku podle vlastnosti `SHEET_ID`, takže data zůstávají v tabulce organizace. Po každé změně kódu je potřeba vydat novou verzi nasazení (Spravovat implementace → Nová verze), jinak dál běží stará.

**Testovací a ostrá tabulka.** Vývoj běží proti testovací tabulce. Před zkouškou nanečisto (den 12) se přepne na ostrou tabulku přístavu:

1. Ostrá tabulka má listy `časovka` (podle aktuálního vzoru včetně bloku OPEN a vzorců pořadí), `crews` a `events`.
2. Ve skriptu se změní vlastnost `SHEET_ID` na ostrou tabulku a `TOKEN` na nové heslo. Vlastnosti se čtou za běhu, takže nová verze nasazení ani nová URL nejsou potřeba.
3. Nový token se zadá v nastavení appky na obou noteboocích.
4. Test nasazení (POST a GET) proti ostré tabulce, pak smazat testovací řádky.

**Kdo má pravdu o posádkách:** každý notebook si pamatuje, v jakém stavu posádky naposledy odeslal do tabulky nebo z ní stáhl. Posádky změněné od té doby automaticky odešle (tak se startovka z hlavního notebooku dostane do tabulky a posádky navíc ze stanovišť taky). Při stažení vyhrává tabulka, pokud notebook nemá vlastní neodeslanou změnu té posádky.

**Časovka nesmí zablokovat zálohu:** když skript nemůže zapsat do časovky (chybí blok kategorie, není volný řádek), události i posádky se uloží a appka jen ukáže varování.

**Stanoviště a výpadek zařízení:** list `stations` v tabulce říká, které zařízení měří které stanoviště. První zařízení, které stanoviště měří, si ho zabere a při každé synchronizaci (nejméně každých 15 s) obnoví čas „naposledy“. Když zařízení vypadne, náhradní (notebook i tablet) na obrazovce Měření stanoviště **převezme**: zapíše se do tabulky jako vlastník a stáhne všechna data včetně startů posádek na trati. Původní zařízení po příštím spojení ukáže „Stanoviště převzalo jiné zařízení“ a zamkne Start, Cíl i opravy. Co mělo neodeslané, ještě odešle do `events` (jsou to skutečná zmáčknutí), ale do časovky zapisuje jen vlastník. Převzetí potřebuje signál.

**Přenos mezi notebooky** má dvě cesty:

1. Přes tabulku: tlačítko Stáhnout načte posádky (včetně startovky) a události a sloučí je (posádky podle startovního čísla, události podle `id`).
2. Přes soubor: Export uloží celý stav do JSON, Import ho na druhém stroji sloučí stejným způsobem. Funguje úplně bez internetu.

**Obnova po havárii:** nový prohlížeč nebo notebook načte stav z tabulky nebo ze souboru a pokračuje v měření. Posádky na trati mají start uložený, takže se o čas nepřijde.

## Bezpečnost a osobní údaje

V repozitáři nesmí být žádná data ani tajemství; kód appky může být veřejný.

- **URL Apps Scriptu a token:** kdo je zná, může do tabulky zapisovat. Zadávají se v nastavení appky a ukládají se jen v prohlížeči, nikdy do kódu. Skript ověřuje sdílený token v každém požadavku.
- **Žádný klíč service accountu ve frontendu:** vše v prohlížeči si může kdokoli přečíst.
- **Jména dětí:** CSV, exporty JSON a loňské tabulky (`*.xlsx`) patří do `.gitignore`. Testovací data v repozitáři budou anonymizovaná.
- **Tabulka** je sdílená jen s organizátory, ne přes veřejný odkaz.
- **Vstup z CSV** se při vykreslení escapuje, aby název posádky nemohl vložit HTML do stránky.

## Technická rozhodnutí

- **Stack:** React + TypeScript + Vite, bez dalších knihoven: žádný router (pět záložek v jednom `useState`), žádný state manager ani UI kit, styly v obyčejném CSS. Appku udržuje jeden člověk.
- **Úložiště v prohlížeči:** `localStorage`. Stačí na stovky událostí (jednotky kB) a je jednoduché.
- **Tablet:** jako měřicí stanoviště funguje v prohlížeči (Chrome na Androidu, Safari na iPadu). Startovku s přetahováním dělat na notebooku, protože na dotykové obrazovce přetahování nemusí fungovat. Safari na iPadu smaže data stránky, když se appka 7 dní neotevře, proto data na iPad stáhnout až těsně před závodem.
- **Hosting:** GitHub Pages s ručně psaným service workerem (cache-first, bez pluginu). Po prvním načtení appka naběhne i bez sítě. Záložní soubor HTML na disku nepomůže, protože z adresy `file://` nejsou vidět data uložená pod `https://`.

## Harmonogram

Plán počítá s 12 pracovními dny a dvěma dny rezervy; zkouška nanečisto je nejpozději tři dny před závodem.

| Dny | Co vznikne | Hotovo, když |
| --- | --- | --- |
| 1–2 | Kostra projektu, datový model, log událostí, import CSV, registrace, ukládání | Posádky z CSV a přidělená čísla přežijí obnovení stránky. |
| 3–4 | Generátor startovky s náhledem délky závodu, ruční úprava, tisk | Startovka pro 27 posádek projde kontrolou limitů. |
| 5–7 | Obrazovka Měření včetně oprav, DNF a posádky navíc | Jde odměřit celý závod a zrušit kteroukoli akci. |
| 8–9 | Výsledovka a tisk, test na loňských datech | Výsledky se shodují s loňskou tabulkou. |
| 10–11 | Apps Script, záloha, časovka, obnova, export/import JSON, service worker | Smazaný prohlížeč se obnoví z tabulky i ze souboru. Člověk může dopsat časy jedné disciplíny do časovky, zatímco appka zapisuje druhou. |
| 12 | Přepnutí na ostrou tabulku, zkouška na dvou noteboocích | Sloučení obou disciplín dá správnou výsledovku. Appka naběhne po restartu bez wifi. |
| 13–14 | Rezerva na opravy |  |

Logika (výpočet časů, generátor, slučování logů) bude oddělená od UI a pokrytá jednotkovými testy, protože chyba v ní by znehodnotila výsledky.
