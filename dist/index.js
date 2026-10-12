import express from "express";
const app = express();
const port = Number(process.env.PORT ?? 3000);
app.get("/", (_req, res) => {
    res.send("Hello from Express and TypeScript!");
});
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
