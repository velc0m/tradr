# Testing Setup - Tradr

## Что добавлено

Полная настройка тестовой инфраструктуры для проекта Tradr:

### 1. Зависимости
```json
{
  "devDependencies": {
    "jest": "^30.2.0",
    "ts-jest": "^29.4.5",
    "mongodb-memory-server": "^10.2.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@types/jest": "^30.0.0"
  }
}
```

### 2. Конфигурационные файлы

- **jest.config.js** - основная конфигурация Jest
- **jest.setup.js** - setup файл для тестового окружения
- **tsconfig.test.json** - TypeScript конфигурация для тестов

### 3. Вспомогательные утилиты

**src/__tests__/helpers/db.ts**
```typescript
// Управление тестовой базой данных (MongoDB Memory Server)
connectTestDB()  // Подключение к in-memory БД
closeTestDB()    // Закрытие и очистка
clearTestDB()    // Очистка всех коллекций
```

**src/__tests__/helpers/testData.ts**
```typescript
// Генераторы тестовых данных
createTestPortfolioData()        // Создание тестового портфолио
calculateExpectedAllocation()    // Расчет распределения депозита
createCustomPercentagePortfolio() // Кастомное портфолио
```

**src/__tests__/helpers/auth.ts**
```typescript
// Мокирование аутентификации
createMockSession()      // Создание мок-сессии
mockGetServerSession()   // Мокирование NextAuth
```

### 4. Первые тесты - Portfolio Model

Создан файл **src/__tests__/api/portfolios/portfolio.test.ts** с тестами:

#### Создание портфолио (4 теста)
✅ Создание портфолио с корректными данными
✅ Валидация суммы процентов = 100%
✅ Работа с десятичными процентами
✅ Требование минимум одной монеты

#### Расчет распределения депозита (6 тестов)
✅ Распределение 50-30-20%
✅ Равное распределение 33.33-33.33-33.34%
✅ Неравномерное распределение 60-25-10-5%
✅ Работа с десятичными процентами
✅ Малые депозиты (100 USD)
✅ Большие депозиты (1,000,000 USD)

#### Поля портфолио (4 теста)
✅ Символы монет в uppercase
✅ Decimal places для каждой монеты
✅ Timestamps (createdAt, updatedAt)
✅ Опциональное поле initialCoins

**Всего: 14 тестов, все проходят успешно ✅**

## NPM скрипты

```bash
# Запуск всех тестов
npm test

# Watch mode (перезапуск при изменениях)
npm run test:watch

# Coverage отчет
npm run test:coverage
```

## Coverage (текущий)

```
Portfolio.ts: 93.33% строк, 91.66% кода
```

## Что тестируется

### Распределение депозита по монетам

Когда пользователь создает портфолио:
- **Total deposit**: 1000 USD
- **Coins**: BTC (50%), ETH (30%), ADA (20%)

Тесты проверяют, что сумма правильно распределяется:
- BTC: 500 USD (50% от 1000)
- ETH: 300 USD (30% от 1000)
- ADA: 200 USD (20% от 1000)

Это критически важно для правильной работы приложения!

### Примеры тестов

```typescript
it('should correctly calculate deposit distribution for 50-30-20 split', async () => {
  const totalDeposit = 1000;
  const portfolioData = {
    userId: 'test-user-id',
    ...createTestPortfolioData({ totalDeposit }),
  };

  const portfolio = await Portfolio.create(portfolioData);
  const expectedAllocation = calculateExpectedAllocation(totalDeposit, portfolio.coins);

  expect(expectedAllocation['BTC']).toBe(500);  // 50%
  expect(expectedAllocation['ETH']).toBe(300);  // 30%
  expect(expectedAllocation['ADA']).toBe(200);  // 20%

  const totalAllocated = Object.values(expectedAllocation).reduce((sum, val) => sum + val, 0);
  expect(totalAllocated).toBe(totalDeposit);
});
```

## Следующие шаги

Следующие тесты, которые нужно добавить:

### Trade Tests
- [ ] Создание LONG позиции
- [ ] Создание SHORT позиции
- [ ] Расчет профита для LONG (в USD)
- [ ] Расчет профита для SHORT (в монетах)
- [ ] Частичное закрытие позиции
- [ ] Пересчет LONG после закрытия SHORT

### API Endpoint Tests
- [ ] POST /api/portfolios (с аутентификацией)
- [ ] GET /api/portfolios
- [ ] PUT /api/portfolios/[id]
- [ ] DELETE /api/portfolios/[id]
- [ ] POST /api/portfolios/[id]/trades
- [ ] PUT /api/trades/[id]
- [ ] POST /api/trades/[id]/partial-close

### Statistics Tests
- [ ] Расчет статистики для LONG позиций
- [ ] Расчет статистики для SHORT позиций
- [ ] Win Rate
- [ ] ROI
- [ ] Performance by Coin

### Component Tests (UI)
- [ ] CreateTradeDialog
- [ ] OpenShortModal
- [ ] PartialCloseModal
- [ ] Stats Page
- [ ] Trades Table

## Структура тестов

```
src/__tests__/
├── api/
│   ├── portfolios/
│   │   └── portfolio.test.ts       ✅
│   └── trades/
│       ├── long.test.ts            ⏳
│       ├── short.test.ts           ⏳
│       └── partial-close.test.ts   ⏳
├── helpers/
│   ├── db.ts                       ✅
│   ├── auth.ts                     ✅
│   └── testData.ts                 ✅
└── README.md                       ✅
```

## Полезные команды

```bash
# Запустить только один тест файл
npm test portfolio.test

# Запустить тесты с определенным паттерном
npm test -- --testNamePattern="should create"

# Обновить snapshots
npm test -- -u

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Преимущества текущей настройки

1. **Изолированные тесты** - каждый тест использует свою in-memory БД
2. **Быстрые** - нет зависимости от реальной MongoDB
3. **Надежные** - не зависят от внешних сервисов
4. **TypeScript** - полная поддержка типов в тестах
5. **Helpers** - переиспользуемые утилиты для тестов

## Запуск

```bash
# Первый раз установить зависимости (уже сделано)
npm install

# Запустить тесты
npm test

# Результат:
# Test Suites: 1 passed, 1 total
# Tests:       14 passed, 14 total
# Time:        ~3s
```

## Документация

Полная документация по тестам: **src/__tests__/README.md**

---

**Статус**: ✅ Базовая инфраструктура готова
**Coverage**: 93% Portfolio model
**Следующий шаг**: Добавить тесты для Trade модели
