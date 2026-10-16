# Slovník domény – časomíra petitratlonu

## Pojmy

- **Disciplína** – jedna ze dvou částí závodu: pramice (P550) a kánoe (C2). Každá posádka jede obě. V datech a v kódu má pramice kód `P5`, lidem se vždy ukazuje jako P550.
- **Stanoviště** – místo, kde je start i cíl jedné disciplíny. Na každém stanovišti je jeden notebook, který měří celou disciplínu.
- **Převzetí stanoviště** – každé stanoviště měří v jednu chvíli právě jedno zařízení (notebook nebo tablet), zapsané v tabulce. Náhradní zařízení stanoviště převezme: stáhne všechna data a od té chvíle měří ono. Původní zařízení po příštím spojení zjistí, že bylo nahrazeno, a přestane dovolovat zápis.
- **Hlavní notebook** – měřicí notebook jednoho stanoviště, na kterém navíc běží registrace, generování startovky a výsledovka. Druhý notebook jen měří svou disciplínu.
- **Kategorie** – pevný seznam seřazený od nejpomalejších: Žabičky, Vlčata, Skautky, Skauti, Roverky, Roveři, OPEN. Pořadí ve výsledovce se určuje uvnitř kategorie. „Světlušky“ jsou totéž co Žabičky; projekt používá jen název Žabičky. Import CSV na velikosti písmen nehledí („Open“ = OPEN), neznámou kategorii odmítne.
- **OPEN** – samostatná kategorie s vlastním pořadím, například pro dospělé nebo smíšené posádky.
- **Posádka** – tým, který jede obě disciplíny a patří do jedné kategorie.
- **Přihlášená posádka** – posádka načtená z CSV před závodem. Ještě nemá startovní číslo a do startovky nepatří.
- **Registrace** – ranní fyzická prezence (končí v 10:00, první start je v 10:30). Posádka, která opravdu přijela, dostane fyzické startovní číslo a registrátor ho opíše do appky. Appka hlídá jen to, aby se číslo neopakovalo. Teprve potom vzniká startovka.
- **Startovní číslo** – jediný identifikátor posádky, platí pro obě disciplíny. Podle něj se posádka páruje mezi notebooky. Jakmile pro posádku existuje první událost, číslo už nejde změnit.
- **Posádka navíc** – posádka, která vznikne až během závodu, třeba po domluvě vedoucích. Obsluha ji přidá přímo na stanovišti a hned ji může odstartovat. Má kategorii (typicky OPEN) a umisťuje se normálně. Číslo jí přidělí organizátoři a obě stanoviště zadají stejné.
- **DNF** – posádka nedokončila disciplínu. Zmizí ze seznamu „na trati“ a ve výsledovce je na konci kategorie bez pořadí, se zkratkou DNF místo času. Jde kdykoli vrátit. Diskvalifikace (DSQ) se zvlášť nerozlišuje, zapisuje se také jako DNF.
- **Nouzový režim** – když appka selže, převezme měření člověk přímo v Google tabulce, jako v minulých letech. Závod nesmí skončit kvůli appce.
- **Časovka** – čitelný list v Google tabulce v rozložení loňského vzoru: bloky po kategoriích, řádek na posádku, P550 i C2 na jednom řádku, časy jako běžné hodiny. Slouží lidem a nouzovému režimu. Surový log událostí je zvlášť a slouží jen k obnově appky.
- **Kormidelník** – člověk, který řídí loď posádky. Startér ho vyvolává podle startovky. Projekt nepoužívá slovo „kapitán“.
- **Start** – skutečný okamžik stisku tlačítka Start. Plánovaný čas ze startovky je jen orientační a do výsledku nevstupuje. Posádky startují po jedné.
- **Čekačka** – čas, který posádka prostála na trati pramice. Zapisuje se na kartičku během trasy P550 a obsluha ho v cíli opíše do appky. Odečítá se od času P550. Kánoe čekačku nemá.

## Rozhodnutí

| Rozhodnutí | Proč |
| --- | --- |
| Startovní číslo nahrazuje interní `id` posádky; události i startovka odkazují na číslo. | Dva identifikátory by se mohly rozejít. |
| Posádka se mezi notebooky páruje podle startovního čísla, ne podle interního `id`. | Posádku navíc přidávají obě stanoviště nezávisle a offline. Jediné, co mají společné, je číslo od organizátorů. |
| Google tabulka zůstává v MVP jako záloha a jako místo pro nouzový režim. | Při selhání appky musí jít v měření pokračovat ručně v tabulce. |
| Každá appka zapisuje do časovky jen sloupce své disciplíny, řádek najde podle startovního čísla. | Když člověk převezme jednu disciplínu, appka druhé disciplíny mu nic nepřepíše. |
| Každou událost posádky jde zrušit i zpětně, ne jen tu poslední. Zrušení je nová událost, nic se nemaže. | DNF i chybný start nebo cíl se může ukázat až po delší době. |
| Příznak „mimo soutěž“ neexistuje; každá posádka se umisťuje ve své kategorii. | Účel pokryje kategorie OPEN; odpadá zvláštní pravidlo pro pořadí. |
| Shoda celkového času na sekundu znamená sdílené místo zobrazené jako rozsah (2.–5.), další posádka je 6. Bez dalšího kritéria. | Shoda je vzácná a další pravidlo by se muselo vysvětlovat. |
| Posádka navíc nemá plánovaný čas startu. Řádek v časovce jí podle čísla najde nebo založí Apps Script v prázdném řádku bloku kategorie. | Startovka je jen orientační. |
| Rozestup startů jde nastavit při generování, doporučená hodnota je 8 minut a formulář ukáže dopad na délku závodu. Limit 4 lodí na trati je orientační a hlídá ho ukazatel na obrazovce Měření, ne generátor. | Loňský medián P550 je 31 min. Při 8 min je průměrně ~4 pramice na trati a starty 27 posádek trvají ~3,5 h. Přísný limit by závod protáhl skoro o 2 h. |
| Na P550 startují posádky od nejpomalejší kategorie (Žabičky → Vlčata → Skautky → Skauti → OPEN), uvnitř kategorie podle startovního čísla. Pořadí na C2 plyne z posunu o polovinu slotů. | Pomalé posádky jedou dlouhou pramici, dokud je trať prázdná, a závod nekončí čekáním na nejpomalejší. |
| Stack: React + TypeScript + Vite, bez dalších knihoven (žádný router, state manager ani UI kit). | Appku udržuje jeden člověk. Obrazovka Měření je živý seznam, kde se React hodí. |
| Hosting na GitHub Pages s ručně psaným service workerem (cache-first). Na zkoušce nanečisto se musí projít krok: vypnout wifi, restartovat a otevřít appku. | Záložní soubor HTML na disku by data uložená pod `https://` neviděl. |
| Apps Script je samostatný projekt (ne vložený do tabulky) a tabulku otevírá podle `SHEET_ID`. | Tabulka je na sdíleném disku organizace; vložený skript tam nejde nasadit jako webová aplikace. |
| Stanoviště vlastní jedno zařízení; převzít ho jde jen se signálem. Události nahrazeného zařízení se přesto uloží, ale do časovky zapisuje jen vlastník. | Dvě zařízení nesmí měřit stejnou trať; skutečně zmáčknutá tlačítka se ale nezahazují. |
