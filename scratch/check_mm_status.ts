
async function main() {
    try {
        const res = await fetch('http://localhost:4000/api/v1/mm-bot/statuses');
        const data = await res.json();
        console.log("MM Bot Statuses:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to fetch MM status:", e);
    }
}
main();
