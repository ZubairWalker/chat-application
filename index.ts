import express from "express";

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).json({message: 'welcome to Chat Application'})
})

const PORT = process.env.PORT || 3000;

const startServer = ():void => {
    try {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Error starting server:', error);
    }
}
startServer();