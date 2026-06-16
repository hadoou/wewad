# Cynex Client API Server

## Установка

```bash
cd server
npm install
```

## Запуск

```bash
npm start
```

Сервер запустится на `http://localhost:3000`

## Стандартный админ

- **Логин:** admin
- **Пароль:** admin123

## Эндпоинты

### Авторизация
- `POST /api/register` - Регистрация
- `POST /api/login` - Вход
- `POST /api/logout` - Выход
- `POST /api/refresh` - Обновление токена
- `GET /api/me` - Текущий пользователь

### Пользователь
- `POST /api/user/set-email` - Изменить email
- `POST /api/user/set-telegram` - Привязать Telegram
- `POST /api/user/change-password` - Сменить пароль
- `POST /api/user/avatar` - Загрузить аватар

### Лицензии
- `POST /api/key/bind` - Активировать ключ
- `POST /api/hwid/reset` - Сброс HWID с токеном
- `POST /api/hwid/reset-free` - Бесплатный сброс HWID

### Админ-ключи
- `POST /api/admin/keys/generate` - Генерация ключей
- `POST /api/admin/keys/add` - Добавить ключ
- `POST /api/admin/keys/extend-all` - Продлить все
- `GET /api/admin/keys/free` - Список ключей
- `POST /api/admin/keys/:id/ban` - Заблокировать
- `POST /api/admin/keys/:id/unban` - Разблокировать
- `POST /api/admin/keys/:id/extend` - Продлить
- `DELETE /api/admin/keys/:id` - Удалить

### Админ-пользователи
- `GET /api/admin/users` - Список пользователей
- `POST /api/admin/users/:id/ban` - Заблокировать
- `POST /api/admin/users/:id/unban` - Разблокировать
- `DELETE /api/admin/users/:id` - Удалить
- `POST /api/admin/users/:id/reset-hwid` - Сброс HWID

### Админ-HWID
- `POST /api/admin/hwid/generate` - Генерация токенов
- `GET /api/admin/hwid/list` - Список токенов
- `DELETE /api/admin/hwid/:id` - Удалить токен

### Админ-промокоды
- `POST /api/admin/promos/create` - Создать промокод
- `GET /api/admin/promos/list` - Список промокодов
- `DELETE /api/admin/promos/:id` - Удалить промокод

## Деплой

Для продакшена установите переменные окружения:
```
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
PORT=3000
```
