# Thermostat Card

Lovelace kaart voor Home Assistant die de **huidige temperatuur** toont en na het aanpassen van het instelpunt (+ / −) **5 seconden het instelpunt weergeeft**, waarna hij automatisch terugschakelt.

## Functies

- Toont actuele gemeten temperatuur
- Na druk op + of −: toont instelpunt 5 seconden (met label "instelpunt")
- Kleur van de middelste bubbel:
  - **Rood** – verwarming actief
  - **Blauw** – koeling actief
  - **Grijs** – uit / idle
  - **Wit** – instelpunt-modus actief
- Geen extra HA helpers nodig (timer wordt intern afgehandeld)
- Configureerbare tap-actie op de middelste bubbel

## Installatie via HACS

1. HACS → Integraties → ⋮ → Aangepaste repositories
2. URL: `https://github.com/JOUWGEBRUIKERSNAAM/thermostat-card`
3. Categorie: **Lovelace**
4. Toevoegen → Installeren

## Configuratie

```yaml
type: custom:thermostat-card
entity: climate.woonkamer
tap_action:
  action: navigate
  navigation_path: /dashboard-thermostaat/verwarming
```

### Opties

| Optie | Verplicht | Standaard | Omschrijving |
|-------|-----------|-----------|--------------|
| `entity` | ✅ | — | Climate entity |
| `tap_action.action` | ❌ | — | `navigate` of `more-info` |
| `tap_action.navigation_path` | ❌ | — | Pad voor navigate actie |
