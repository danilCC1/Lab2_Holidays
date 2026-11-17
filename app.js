"use strict";

// Адреса API для отримання державних свят
const API_URL = "https://date.nager.at/api/v3";

// Елементи інтерфейсу
const countrySelect = document.querySelector("#country");
const yearSelect = document.querySelector("#year");
const statusElement = document.querySelector("#status");
const holidayList = document.querySelector("#holiday-list");
const holidayCount = document.querySelector("#holiday-count");
const nearestHoliday = document.querySelector("#nearest-holiday");

const compareCountry1 = document.querySelector("#compare-country-1");
const compareCountry2 = document.querySelector("#compare-country-2");
const compareButton = document.querySelector("#compare-btn");
const comparisonResult = document.querySelector("#comparison-result");

// Оператори бібліотеки RxJS
const { fromEvent, merge, of, from, interval } = rxjs;
const { map, startWith, switchMap, catchError } = rxjs.operators;

// Поточний стан застосунку
let currentHolidays = [];
let currentNearestHoliday = null;

// Формування списку років
function initializeYears() {
    const currentYear = new Date().getFullYear();

    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
        const option = document.createElement("option");

        option.value = year;
        option.textContent = year;

        if (year === currentYear) {
            option.selected = true;
        }

        yearSelect.appendChild(option);
    }
}

// Отримання назви країни
function getCountryName(code) {
    const option = Array.from(countrySelect.options)
        .find(item => item.value === code);

    return option ? option.textContent : code;
}

// Форматування дати
function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

// Отримання поточної дати без часу
function getToday() {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}

// Перетворення рядка API на локальну дату
function parseHolidayDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day);
}

// Повідомлення про стан запиту
function setStatus(message, type = "") {
    statusElement.textContent = message;
    statusElement.className = "status";

    if (type) {
        statusElement.classList.add(type);
    }
}

// Асинхронне отримання свят через API
async function fetchHolidays(country, year, signal) {
    const url = `${API_URL}/PublicHolidays/${year}/${country}`;

    const response = await fetch(url, { signal });

    if (!response.ok) {
        throw new Error(
            `Помилка сервера: HTTP ${response.status}`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Отримано некоректні дані від API.");
    }

    return data.sort((a, b) => a.date.localeCompare(b.date));
}

// Визначення типу свята
function getHolidayType(holiday) {
    if (!Array.isArray(holiday.types)) {
        return "Не вказано";
    }

    const typeNames = {
        Public: "Державне",
        Bank: "Банківське",
        School: "Шкільне",
        Authorities: "Для державних установ",
        Optional: "Необов'язкове",
        Observance: "Пам'ятна дата"
    };

    return holiday.types
        .map(type => typeNames[type] || type)
        .join(", ") || "Не вказано";
}

// Створення клітинки таблиці
function createCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    row.appendChild(cell);

    return cell;
}

// Пошук найближчого майбутнього свята
function findNearestHoliday(holidays) {
    const today = getToday();

    return holidays.find(holiday => {
        const holidayDate = parseHolidayDate(holiday.date);

        return holidayDate >= today;
    }) || null;
}

// Відображення списку свят
function renderHolidays(holidays) {
    holidayList.replaceChildren();

    holidayCount.textContent = `${holidays.length} свят`;

    if (holidays.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 4;
        cell.textContent = "За вибраними параметрами свят не знайдено.";

        row.appendChild(cell);
        holidayList.appendChild(row);
        return;
    }

    const fragment = document.createDocumentFragment();

    holidays.forEach(holiday => {
        const row = document.createElement("tr");

        if (holiday === currentNearestHoliday) {
            row.classList.add("holiday-nearest");
        }

        createCell(row, formatDate(holiday.date));
        createCell(row, holiday.name);
        createCell(row, holiday.localName);
        createCell(row, getHolidayType(holiday));

        fragment.appendChild(row);
    });

    holidayList.appendChild(fragment);
}

// Оновлення лічильника днів до свята
function updateNearestHoliday() {
    if (!currentNearestHoliday) {
        nearestHoliday.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "У вибраному році немає майбутніх свят.";

        nearestHoliday.appendChild(message);
        return;
    }

    const today = getToday();
    const holidayDate = parseHolidayDate(currentNearestHoliday.date);

    const daysLeft = Math.round(
        (Date.UTC(
            holidayDate.getFullYear(),
            holidayDate.getMonth(),
            holidayDate.getDate()
        ) - Date.UTC(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        )) / 86400000
    );

    nearestHoliday.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = currentNearestHoliday.name;

    const date = document.createElement("p");
    date.textContent =
        `Дата: ${formatDate(currentNearestHoliday.date)}`;

    const country = document.createElement("p");
    country.textContent =
        `Країна: ${getCountryName(countrySelect.value)}`;

    const counter = document.createElement("span");
    counter.className = "days-counter";

    counter.textContent = daysLeft === 0
        ? "Свято сьогодні!"
        : `До свята залишилося: ${daysLeft} дн.`;

    nearestHoliday.append(title, date, country, counter);
}

// Обробка результату запиту
function displayHolidays(holidays) {
    currentHolidays = holidays;
    currentNearestHoliday = findNearestHoliday(holidays);

    renderHolidays(holidays);
    updateNearestHoliday();

    if (holidays.length === 0) {
        setStatus("Для вибраної країни та року даних немає.");
    } else {
        setStatus(
            `Завантажено ${holidays.length} свят для країни ` +
            `${getCountryName(countrySelect.value)}.`,
            "success"
        );
    }
}

// Реактивне завантаження даних через RxJS
function initializeHolidayStream() {
    const countryChanges = fromEvent(countrySelect, "change");
    const yearChanges = fromEvent(yearSelect, "change");

    const parameters$ = merge(countryChanges, yearChanges).pipe(
        startWith(null),
        map(() => ({
            country: countrySelect.value,
            year: yearSelect.value
        }))
    );

    let activeController = null;

    parameters$.pipe(
        switchMap(({ country, year }) => {
            if (activeController) {
                activeController.abort();
            }

            activeController = new AbortController();

            const signal = activeController.signal;

            setStatus("Завантаження державних свят...");

            currentHolidays = [];
            currentNearestHoliday = null;
            holidayList.replaceChildren();
            holidayCount.textContent = "0 свят";
            nearestHoliday.textContent = "Завантаження...";

            return from(fetchHolidays(country, year, signal)).pipe(
                map(holidays => ({
                    holidays,
                    error: null
                })),
                catchError(error => {
                    if (error.name === "AbortError") {
                        return of(null);
                    }

                    return of({
                        holidays: [],
                        error: error.message
                    });
                })
            );
        })
    ).subscribe(result => {
        if (!result) {
            return;
        }

        if (result.error) {
            currentHolidays = [];
            currentNearestHoliday = null;

            renderHolidays([]);
            updateNearestHoliday();

            setStatus(
                `Не вдалося отримати дані: ${result.error}`,
                "error"
            );
            return;
        }

        displayHolidays(result.holidays);
    });
}

// Оновлення лічильника через RxJS interval
function initializeCounter() {
    interval(60000).subscribe(() => {
        if (currentHolidays.length > 0) {
            const nextHoliday = findNearestHoliday(currentHolidays);

            if (nextHoliday !== currentNearestHoliday) {
                currentNearestHoliday = nextHoliday;
                renderHolidays(currentHolidays);
            }

            updateNearestHoliday();
        }
    });
}

// Підрахунок дат свят, які є державними вихідними
function countPublicHolidays(holidays) {
    const uniqueDates = new Set(
        holidays
            .filter(holiday =>
                Array.isArray(holiday.types) &&
                holiday.types.includes("Public")
            )
            .map(holiday => holiday.date)
    );

    return uniqueDates.size;
}

// Створення картки порівняння
function createComparisonCard(countryCode, count) {
    const card = document.createElement("div");
    card.className = "comparison-card";

    const title = document.createElement("h3");
    title.textContent = getCountryName(countryCode);

    const number = document.createElement("span");
    number.className = "comparison-number";
    number.textContent = count;

    const label = document.createElement("span");
    label.className = "comparison-label";
    label.textContent = "дат державних свят";

    card.append(title, number, label);

    return card;
}

// Порівняння двох країн через Promise.all
async function compareCountries() {
    const country1 = compareCountry1.value;
    const country2 = compareCountry2.value;
    const year = yearSelect.value;

    comparisonResult.replaceChildren();

    if (country1 === country2) {
        comparisonResult.textContent =
            "Для порівняння виберіть дві різні країни.";
        return;
    }

    compareButton.disabled = true;
    comparisonResult.textContent = "Виконується порівняння...";

    try {
        const [holidays1, holidays2] = await Promise.all([
            fetchHolidays(country1, year),
            fetchHolidays(country2, year)
        ]);

        const count1 = countPublicHolidays(holidays1);
        const count2 = countPublicHolidays(holidays2);

        const grid = document.createElement("div");
        grid.className = "comparison-grid";

        grid.append(
            createComparisonCard(country1, count1),
            createComparisonCard(country2, count2)
        );

        comparisonResult.replaceChildren(grid);

        const summary = document.createElement("p");

        if (count1 === count2) {
            summary.textContent =
                "Обидві країни мають однакову кількість дат державних свят.";
        } else {
            const winner = count1 > count2 ? country1 : country2;
            const difference = Math.abs(count1 - count2);

            summary.textContent =
                `${getCountryName(winner)} має на ${difference} ` +
                `дат державних свят більше.`;
        }

        comparisonResult.appendChild(summary);
    } catch (error) {
        comparisonResult.textContent =
            `Помилка порівняння: ${error.message}`;
    } finally {
        compareButton.disabled = false;
    }
}

// Запуск застосунку
function initializeApp() {
    initializeYears();
    initializeHolidayStream();
    initializeCounter();

    fromEvent(compareButton, "click")
        .subscribe(() => compareCountries());
}

initializeApp();
