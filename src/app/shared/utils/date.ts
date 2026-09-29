

export const getBDDate = () => {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);

    const day = parts.find((part) => part.type === "day")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const year = parts.find((part) => part.type === "year")?.value;

    return `${year}${month}${day}`;
};