const templates = [
    { day: 2, time: '10:00', duration: 60 },
    { day: 4, time: '10:00', duration: 60, client: '11111111-1111-4111-8111-111111111111' },
];
const month = 2, year = 2026;
const daysInMonth = new Date(year, month, 0).getDate();
const pad = (n) => n.toString().padStart(2, '0');
const formatDateWithOffset = (d) => {
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const tzOffsetMin = -d.getTimezoneOffset();
    const tzSign = tzOffsetMin >= 0 ? '+' : '-';
    const absOffsetMin = Math.abs(tzOffsetMin);
    const tzHours = pad(Math.floor(absOffsetMin / 60));
    const tzMinutes = pad(absOffsetMin % 60);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
};

const eventsToCreate = [];
for (const t of templates) {
    let templateDay = null;
    if (typeof t.day === 'number') {
        templateDay = t.day;
        if (templateDay === 7) templateDay = 0;
    } else if (t.datetime) {
        templateDay = new Date(t.datetime).getDay();
    }
    if (typeof templateDay !== 'number') continue;

    let hours = 10;
    let minutes = 0;
    if (typeof t.time === 'string' && t.time.includes(':')) {
        const [h, m] = t.time.split(':').map((s) => parseInt(s, 10) || 0);
        hours = h;
        minutes = m;
    } else if (t.datetime) {
        const dt = new Date(t.datetime);
        hours = dt.getHours();
        minutes = dt.getMinutes();
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        if (currentDate.getDay() === templateDay) {
            currentDate.setHours(hours, minutes, 0, 0);
            eventsToCreate.push({
                type: 'class',
                datetime: formatDateWithOffset(currentDate),
                duration: t.duration || 60,
                client: Array.isArray(t.client) ? t.client : t.client ? [t.client] : [],
                professional: Array.isArray(t.professional) ? t.professional : t.professional ? [t.professional] : [],
                company: 'company-1',
                notes: t.notes || '',
            });
        }
    }
}

const clientCounts = {};
for (const ev of eventsToCreate) {
    const clients = Array.isArray(ev.client) ? ev.client : ev.client ? [ev.client] : [];
    for (const c of clients) {
        clientCounts[c] = (clientCounts[c] || 0) + 1;
    }
}

console.log('eventsCount', eventsToCreate.length);
console.log(eventsToCreate.map((e) => ({ d: e.datetime, clients: e.client })));
console.log('clientCounts', clientCounts);
