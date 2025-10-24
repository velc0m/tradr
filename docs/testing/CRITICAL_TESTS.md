# 🔴 Критические тесты - Test Guide

Этот документ объясняет **самые важные тесты** в проекте, которые **нельзя удалять или ломать**.

---

## ⚠️ Критические тесты отмечены так:

В файлах тестов ищи комментарии:
```typescript
// ⚠️ CRITICAL TEST - DO NOT REMOVE
```

---

## 1. Trade Model - initialEntryPrice и initialAmount

**Файл**: `src/__tests__/models/trade.test.ts`
**Строки**: 315-344 и 346-375

### Почему критично:

Эти поля **НИКОГДА** не должны меняться после создания trade.

#### initialEntryPrice
```typescript
// Создаем LONG с entryPrice = 100,000
const trade = await Trade.create({
  entryPrice: 100000,
  initialEntryPrice: 100000,  // ← Запоминаем навсегда
});

// Через месяц закрываем SHORT, entryPrice пересчитывается
trade.entryPrice = 95000;
await trade.save();

// НО initialEntryPrice остается 100,000 ✓
expect(trade.initialEntryPrice).toBe(100000);
```

**Что происходит в реальной жизни:**
1. Открываешь LONG на 1 BTC по цене 100,000 USD
2. `entryPrice = 100,000`, `initialEntryPrice = 100,000`
3. Открываешь SHORT на 0.5 BTC, продаешь по 110,000
4. Закрываешь SHORT, выкупаешь по 105,000
5. Выкупил 0.52 BTC (профит в монетах!)
6. Теперь у LONG 1.02 BTC вместо 1.0
7. **entryPrice пересчитывается**: `100,000 / 1.02 = 98,039 USD`
8. **НО initialEntryPrice остается 100,000** - это твоя оригинальная цена входа

**Зачем это нужно:**
- Для истории: можешь увидеть по какой цене **изначально** купил
- Для отчетов: профит рассчитывается от initial, а не от текущей
- Для налогов: нужна оригинальная стоимость

**Если этот тест сломается:**
- Потеряется история оригинальной цены входа
- Невозможно будет рассчитать реальный ROI
- SHORT операции будут портить исторические данные

---

#### initialAmount

```typescript
// Создаем LONG с 1.0 BTC
const trade = await Trade.create({
  amount: 1.0,
  initialAmount: 1.0,  // ← Запоминаем навсегда
});

// После SHORT close добавились монеты
trade.amount = 1.05;  // Теперь 1.05 BTC
await trade.save();

// НО initialAmount остается 1.0 ✓
expect(trade.initialAmount).toBe(1.0);
```

**Что происходит в реальной жизни:**
1. Купил 1.0 BTC
2. Открыл SHORT, продал 0.5 BTC
3. Закрыл SHORT, выкупил 0.52 BTC (профит!)
4. Теперь у тебя 1.02 BTC
5. **amount = 1.02**, но **initialAmount = 1.0**

**Зачем это нужно:**
- Знаешь сколько **изначально** купил
- Можешь рассчитать сколько заработал через SHORT (1.02 - 1.0 = 0.02 BTC)
- Для отчетов и статистики

**Если этот тест сломается:**
- Невозможно будет посчитать сколько монет заработал через SHORT
- История оригинального размера позиции пропадет

---

## 2. Calculations - LONG Profit USD

**Файл**: `src/__tests__/lib/calculations.test.ts`
**Строки**: 9-26

### Почему важно:

Формула расчета профита LONG - это **основа всего приложения**.

```typescript
// Вложил 1010 USD, получил 0.01 BTC
// Продал по 110,000 с fee 1%

const profit = calculateLongProfitUSD(0.01, 1010, 110000, 1);

// Exit value: 0.01 × 110,000 × 0.99 = 1089 USD
// Profit: 1089 - 1010 = 79 USD
expect(profit).toBeCloseTo(79, 1);
```

**Формула:**
```
exitValue = amount × exitPrice × (100 - exitFee) / 100
profit = exitValue - sumPlusFee
```

**Если этот тест сломается:**
- Все профиты LONG будут рассчитаны неправильно
- Пользователи увидят неверные цифры
- Статистика будет испорчена

---

## 3. Calculations - SHORT Profit Coins

**Файл**: `src/__tests__/lib/calculations.test.ts`
**Строки**: 111-132

### Почему критично:

SHORT профит считается **в монетах**, не в USD!

```typescript
// Продал 0.5 BTC, получил 54,450 USD
// Выкупил по 100,000 с fee 1%

const profitCoins = calculateShortProfitCoins(0.5, 54450, 100000, 1);

// Buy back price: 100,000 × 1.01 = 101,000
// Coins bought: 54,450 / 101,000 = 0.5391 BTC
// Profit: 0.5391 - 0.5 = 0.0391 BTC
expect(profitCoins).toBeCloseTo(0.0391, 4);
```

**Формула:**
```
buyBackPriceWithFee = buyBackPrice × (100 + buyBackFee) / 100
coinsBoughtBack = sumPlusFee / buyBackPriceWithFee
profit = coinsBoughtBack - soldAmount
```

**ВАЖНО:** Профит в **монетах**, не в долларах!

**Если этот тест сломается:**
- SHORT профит будет неправильный
- Parent LONG не обновится корректно
- Может быть путаница между USD и монетами

---

## 4. Calculations - recalculateLongEntryPrice

**Файл**: `src/__tests__/lib/calculations.test.ts`
**Строки**: 230-243

### Почему критично:

Когда SHORT закрывается, нужно пересчитать entry price родительского LONG.

```typescript
// LONG: потратил 100,000 USD на 1.0 BTC
// После SHORT: теперь 1.05 BTC (добавились выкупленные)

const newEntryPrice = recalculateLongEntryPrice(100000, 1.05);

// 100,000 / 1.05 = 95,238.095
expect(newEntryPrice).toBeCloseTo(95238.095, 2);
```

**Формула:**
```
newEntryPrice = originalSumPlusFee / newTotalAmount
```

**Что это значит:**
- Ты потратил 100,000 USD
- Теперь у тебя 1.05 BTC вместо 1.0
- Твоя эффективная цена входа: 95,238 USD за BTC (улучшилась!)

**Если этот тест сломается:**
- Parent LONG не обновится после SHORT
- Entry price будет неправильный
- Профит LONG будет рассчитан неверно

---

## 5. Portfolio - Coin Allocation

**Файл**: `src/__tests__/api/portfolios/portfolio.test.ts`
**Строки**: 88-113

### Почему важно:

Проверяет что депозит **правильно разбивается** по монетам.

```typescript
// Депозит: 1000 USD
// BTC: 50%, ETH: 30%, ADA: 20%

const allocation = calculateExpectedAllocation(1000, coins);

expect(allocation['BTC']).toBe(500);  // 50%
expect(allocation['ETH']).toBe(300);  // 30%
expect(allocation['ADA']).toBe(200);  // 20%
```

**Если этот тест сломается:**
- Депозит распределится неправильно
- Пользователь купит не то количество монет
- Пропорции портфеля будут неверны

---

## Как найти критические тесты:

### 1. Через поиск в IDE:
```
⚠️ CRITICAL TEST
```

### 2. Через grep:
```bash
grep -r "CRITICAL TEST" src/__tests__/
```

### 3. Через этот документ:
Все критические тесты описаны здесь с номерами строк.

---

## Что делать если критический тест падает:

### ❌ НЕ НАДО:
- Удалять тест
- Комментировать тест
- Менять `expect()` чтобы тест прошел

### ✅ НАДО:
1. **Остановись** - критический тест падает не просто так
2. **Прочитай комментарии** в тесте - там объяснено почему это критично
3. **Найди баг** в коде, который ломает тест
4. **Исправь код**, не тест
5. Если **реально** нужно изменить логику - сначала **обсуди** изменения

---

## Добавление новых критических тестов:

Если добавляешь критический функционал, отметь тест так:

```typescript
// ⚠️ CRITICAL TEST - DO NOT REMOVE
// Why: [Почему этот тест критичен]
// Use case: [Когда это используется]
// If this breaks: [Что сломается]
it('should do critical thing', async () => {
  // test code
});
```

---

## Краткий чеклист критических вещей:

- [ ] `initialEntryPrice` никогда не меняется
- [ ] `initialAmount` никогда не меняется
- [ ] LONG profit считается в USD
- [ ] SHORT profit считается в монетах (coins)
- [ ] Parent LONG обновляется при SHORT close
- [ ] Entry price пересчитывается при SHORT close
- [ ] Fees правильно учитываются (вычитаются/добавляются)
- [ ] Coin allocation правильно распределяет депозит

---

## Быстрые ссылки на критические тесты:

| Тест | Файл | Строка | Что проверяет |
|------|------|--------|---------------|
| initialEntryPrice never changes | trade.test.ts | 315 | Сохранение оригинальной цены входа |
| initialAmount never changes | trade.test.ts | 346 | Сохранение оригинального количества |
| LONG profit USD | calculations.test.ts | 11 | Расчет профита LONG в долларах |
| SHORT profit coins | calculations.test.ts | 111 | Расчет профита SHORT в монетах |
| recalculate LONG entry price | calculations.test.ts | 230 | Пересчет цены после SHORT |
| Coin allocation 50-30-20 | portfolio.test.ts | 88 | Правильное распределение депозита |

---

## 🔥 Если сомневаешься - НЕ ТРОГАЙ критические тесты!

Лучше **спроси** или **прочитай** этот документ еще раз.

**Критические тесты защищают самую важную логику приложения.**
