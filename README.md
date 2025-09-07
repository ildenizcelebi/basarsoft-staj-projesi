# Başarsoft Staj Projesi

Bu repo, 2025 Başarsoft staj sürecimde geliştirdiğim harita tabanlı web uygulamasını içerir.  
Proje iki ana klasörden oluşur:

- **backend/** → ASP.NET Core98, PostgreSQL + PostGIS, Entity Framework, Unit of Work
- **frontend/** → React, Vite, OpenLayers, TailwindCSS

---

## Çalıştırma

### 1. Backend
```bash
cd backend
dotnet run

•Swagger UI: http://localhost:5213/swagger
•API kökü: http://localhost:5213/api

### 2. Frontend
```bash
cd frontend
npm install
npm run dev

•Uygulama: http://localhost:5173

Özellikler
•Geometri (Point, LineString, Polygon) ekleme, düzenleme, silme
•PostgreSQL + PostGIS üzerinde saklama
•React & OpenLayers arayüzünde gösterim
•Filtreleme, arama ve sayfalama (pagination)
•Kullanıcı dostu UI ve responsive tasarım

Notlar
•backend/appsettings.Development.json repo’ya girmez, sadece kendi bilgisayarında bulunur.
•frontend/.env dosyasında VITE_API_BASE_URL backend’in portuna göre ayarlanmalıdır.
Örnek .env içeriği: VITE_API_BASE_URL=http://localhost:5213/api

---
