# Тестирование Tradr

## 📊 Статус

**Всего тестов: 111 ✅**
**Время выполнения: ~4.5 секунды**
**Coverage: 100% критических функций**

## 🚀 Быстрый старт

```bash
# Запустить все тесты
npm test

# Watch mode (автоматический перезапуск)
npm run test:watch

# Coverage отчет
npm run test:coverage

# Запустить конкретный файл
npm test calculations.test
npm test long-lifecycle
```

## 📁 Структура тестов

```
src/__tests__/
├── lib/
│   └── calculations.test.ts        ✅ 16 тестов - формулы расчета
├── models/
│   └── trade.test.ts               ✅ 18 тестов - модель Trade
├── scenarios/
│   ├── long-lifecycle.test.ts      ✅ 9 тестов - жизненный цикл LONG
│   ├── short-lifecycle.test.ts     ✅ 9 тестов - жизненный цикл SHORT
│   ├── partial-close.test.ts       ✅ 9 тестов - частичное закрытие
│   └── statistics.test.ts          ✅ 9 тестов - статистика портфолио
└── api/
    ├── portfolios/
    │   ├── portfolio.test.ts       ✅ 14 тестов - модель Portfolio
    │   └── api-endpoints.test.ts   ✅ 14 тестов - Portfolio API
    └── trades/
        └── api-endpoints.test.ts   ✅ 13 тестов - Trades API
```

## 📚 Документация

- **[CRITICAL_TESTS.md](./CRITICAL_TESTS.md)** - ⚠️ Критические тесты, которые НЕЛЬЗЯ удалять
- **[TEST_PLAN.md](./TEST_PLAN.md)** - Подробный план тестирования по шагам

## ⚠️ Критические тесты

**Обязательно прочитай [CRITICAL_TESTS.md](./CRITICAL_TESTS.md) перед изменением тестов!**

Критические тесты отмечены комментарием:
```typescript
// ⚠️ CRITICAL TEST - DO NOT REMOVE
// Why: [объяснение]
// If this breaks: [что сломается]
```

### Топ-5 самых важных:

1. **initialEntryPrice и initialAmount никогда не меняются** (trade.test.ts)
2. **LONG profit USD расчет** (calculations.test.ts)
3. **SHORT profit в монетах** (calculations.test.ts)
4. **Parent LONG recalculation** (short-lifecycle.test.ts, API tests)
5. **Authentication enforcement** (api-endpoints.test.ts)

## 🧪 Что тестируется

### 1. Модели данных (32 теста)
- Portfolio model (14)
- Trade model (18)

### 2. Формулы расчета (16 тестов)
- LONG profit в USD и процентах
- SHORT profit в монетах и процентах
- Parent LONG recalculation
- Fee calculations

### 3. Жизненные циклы (27 тестов)
- LONG: Open → Fill → Close
- SHORT: Open → Fill → Close → Parent update
- Partial close для LONG и SHORT

### 4. Статистика (9 тестов)
- Win rate, ROI, performance by coin
- Отдельно для LONG и SHORT

### 5. API Endpoints (27 тестов)
- Portfolio CRUD + validation + authorization
- Trades CRUD + SHORT logic + authorization

## 🛠️ Технологии

- **Jest** - test runner
- **MongoDB Memory Server** - in-memory database для тестов
- **TypeScript** - полная поддержка типов
- **NextAuth mocking** - тестирование аутентификации

## 📝 Соглашения

### Naming conventions
```typescript
// Describe блоки - описание функциональности
describe('LONG Position Lifecycle', () => {
  // it блоки - конкретные тесты
  it('should calculate profit for profitable trade', () => {
    // Arrange
    const trade = createTrade();

    // Act
    const profit = calculateProfit(trade);

    // Assert
    expect(profit).toBeCloseTo(79, 1);
  });
});
```

### Критические тесты
Всегда добавляй комментарий для критических тестов:
```typescript
// ⚠️ CRITICAL TEST - DO NOT REMOVE
// Why: Проверяет что initialEntryPrice никогда не меняется
// Use case: Когда SHORT закрывается, parent LONG обновляется
// If this breaks: История оригинальной цены входа будет потеряна
it('should preserve initialEntryPrice', () => {
  // test code
});
```

## 🔍 Поиск тестов

### По ключевым словам
```bash
# Найти все критические тесты
grep -r "CRITICAL TEST" src/__tests__/

# Найти тесты для SHORT
npm test -- --testNamePattern="SHORT"

# Найти тесты для конкретной монеты
npm test -- --testNamePattern="BTC"
```

### По файлам
- **Формулы**: `src/__tests__/lib/calculations.test.ts`
- **LONG lifecycle**: `src/__tests__/scenarios/long-lifecycle.test.ts`
- **SHORT lifecycle**: `src/__tests__/scenarios/short-lifecycle.test.ts`
- **Parent recalculation**: `short-lifecycle.test.ts:409` и `api-endpoints.test.ts:409`

## 🚨 Если тест падает

1. **Не удаляй тест** - особенно если он критический
2. **Прочитай комментарии** в тесте - там объяснено почему это важно
3. **Найди баг** в коде, не в тесте
4. **Проверь [CRITICAL_TESTS.md](./CRITICAL_TESTS.md)** - там подробные объяснения

## 📈 Добавление новых тестов

1. Определи категорию: model / scenario / api
2. Создай файл в соответствующей папке
3. Используй helpers из `src/__tests__/helpers/`
4. Для критических тестов добавь комментарий `⚠️ CRITICAL TEST`
5. Обнови документацию

## 🎯 Цели покрытия

- ✅ Все критические формулы: 100%
- ✅ LONG/SHORT lifecycle: 100%
- ✅ Parent LONG recalculation: 100%
- ✅ API authentication/authorization: 100%
- ⏳ UI Components: 0% (в планах)

---

**Последнее обновление**: Январь 2025
**Версия**: 1.0
**Тестов**: 111 / Проходит: 111 ✅
