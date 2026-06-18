# Checklista po wdrozeniu

Ta lista sluzy do szybkiej weryfikacji, ze nowa wersja aplikacji dziala poprawnie po aktualizacji.

## 1. Kontenery i healthcheck

Uruchom z katalogu projektu:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3001/api/v1/health
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

Sprawdz:

- `app`, `postgres`, `redis`, `minio` sa `Up`
- `postgres` i `redis` maja status `healthy`
- healthcheck zwraca `status=ok`
- logi aplikacji nie pokazuja bledu startu, bledu Prisma ani bledu JWT

## 2. Logowanie

Sprawdz w przegladarce:

- strona logowania laduje sie poprawnie
- poprawne dane logowania wpuszczaja do aplikacji
- bledne dane logowania daja kontrolowany blad
- wylogowanie dziala i konczy sesje

## 3. Wymuszenie zmiany hasla

Sprawdz na koncie z `mustChangePassword`:

- po zalogowaniu uzytkownik trafia do profilu
- nie moze normalnie korzystac z pozostalych widokow przed zmiana hasla
- nowe haslo przechodzi walidacje tylko wtedy, gdy spelnia wymagania
- po zmianie hasla normalna praca w aplikacji jest odblokowana

## 4. Role i zakres danych

### SUPER_ADMIN

Sprawdz:

- widzi dane globalne
- moze wejsc do funkcji globalnych
- moze przypisac admina do jednostki
- widzi semestry i ich operacje administracyjne

### ADMIN

Sprawdz:

- widzi tylko swoja jednostke
- moze dodawac i edytowac dane swojej jednostki
- nie widzi danych spoza swojego scope

### PLANNER

Sprawdz:

- moze pracowac na planie i przydzialach swojej jednostki
- nie moze wejsc do funkcji globalnych ani cudzych danych

### DEAN

Sprawdz:

- ma tylko podglad i analityke
- nie moze wykonywac operacji zapisu
- widzi dane wydzialowe zgodnie z zakresem

### VIEWER

Sprawdz:

- ma tylko odczyt
- nie widzi przyciskow i akcji edycyjnych

## 5. Najwazniejsze slowniki i operacje

Przetestuj co najmniej po jednej operacji:

- kierunki
- grupy
- sale
- nauczyciele
- przedmioty
- przydzialy
- wpis do planu
- zapotrzebowanie kadrowe

Sprawdz:

- zapis konczy sie sukcesem
- walidacja pokazuje sensowny blad
- nie da sie zapisac danych spoza dozwolonego scope

## 6. Cache i przelaczanie kontekstu

Sprawdz:

- po wylogowaniu i ponownym zalogowaniu nie zostaja stare dane
- po zmianie roli albo kontekstu nie pojawiaja sie dane superadmina u zwyklego uzytkownika
- przelaczanie zakladek nie pokazuje szerszego zakresu niz powinno

## 7. Backupy

Sprawdz:

- katalog `backups` istnieje
- pojawiaja sie w nim pliki `.sql`
- ostatni backup nie ma rozmiaru `0`

Przydatne polecenie:

```bash
ls -lh backups | tail
```

## 8. Koniec testu

Wdrozenie mozna uznac za poprawne, jezeli:

- kontenery dzialaja stabilnie
- healthcheck jest poprawny
- logowanie i wylogowanie dziala
- wymuszenie zmiany hasla dziala
- role widza tylko swoje dane
- kluczowe operacje zapis/odczyt przechodza
- backupy dalej sie tworza
