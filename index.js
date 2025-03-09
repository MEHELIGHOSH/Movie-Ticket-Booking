const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator');
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
    connection.release();
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        console.error('Authorization header is missing');
        return res.status(401).send({ message: 'Access Denied' });
    }

    const token = authHeader.split(' ')[1]; // Extract token after 'Bearer'
    if (!token) {
        console.error('Token is missing in Authorization header');
        return res.status(401).send({ message: 'Access Denied' });
    }

    console.log('Extracted Token:', token); // Log extracted token
    console.log('JWT Secret:', process.env.JWT_SECRET); // Log JWT secret used for verification

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message); // Log verification errors
            return res.status(403).send({ message: 'Invalid Token' });
        }
        req.user = user;
        next();
    });
};


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use(limiter);

app.get('/health', (req, res) => {
    res.status(200).send({ status: 'API is running' });
});

app.post('/login', (req, res) => {
    const { username, password, role } = req.body;

    if (role !== 'theater' && role !== 'user') {
        return res.status(400).send({ message: 'Invalid role specified. Use "theater" for theater owners or "user" for regular users.' });
    }

    const table = role === 'theater' ? 'theater_owners' : 'users';

    db.query(`SELECT * FROM ${table} WHERE username = ?`, [username], (err, results) => {
        if (err) return res.status(500).send({ message: 'Internal server error', error: err });

        if (results.length === 0 || results[0].password !== password) {
            return res.status(401).send({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: results[0].id, role: role === 'theater' ? 'theater_owner' : 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.send({ token, role: role === 'theater' ? 'theater_owner' : 'user' });
    });
});

app.post('/shows', authenticateToken, [
    body('movie_id').isNumeric(),
    body('total_seats').isNumeric(),
    body('base_price').isNumeric(),
    body('show_time').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { movie_id, total_seats, base_price, show_time } = req.body;

    // Only theater owners can add shows
    if (req.user.role !== 'theater_owner') {
        return res.status(403).send({ message: 'Forbidden' });
    }

    db.query('INSERT INTO shows (movie_id, total_seats, base_price, show_time) VALUES (?, ?, ?, ?)',
        [movie_id, total_seats, base_price, show_time], (err, result) => {
            if (err) return res.status(500).send(err);
            res.status(201).send({ message: 'Show added', id: result.insertId });
        });
});


app.get('/shows', (req, res) => {
    const { movie_id } = req.query;
    let query = 'SELECT * FROM shows';
    let params = [];

    if (movie_id) {
        query += ' WHERE movie_id = ?';
        params.push(movie_id);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

app.post('/movies', authenticateToken, [
    body('title').notEmpty(),
    body('genre').notEmpty(),
    body('duration').isNumeric()
], (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}, (req, res) => {
    const { title, genre, duration } = req.body;
    if (req.user.role !== 'theater_owner') return res.status(403).send({ message: 'Forbidden' });

    db.query('INSERT INTO movies (title, genre, duration, owner_id) VALUES (?, ?, ?, ?)',
        [title, genre, duration, req.user.id], (err, result) => {
            if (err) return res.status(500).send(err);
            res.status(201).send({ message: 'Movie added', id: result.insertId });
        });
});

app.get('/movies', (req, res) => {
    const { genre, title } = req.query;
    let query = 'SELECT * FROM movies';
    let params = [];

    if (genre) {
        query += ' WHERE genre = ?';
        params.push(genre);
    }
    if (title) {
        query += genre ? ' AND title = ?' : ' WHERE title = ?';
        params.push(title);
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).send(err);
        res.send(results);
    });
});

const transporter = require('./transporter'); // Import the transporter

app.post('/bookings', [
    body('user_id').isNumeric(),
    body('show_id').isNumeric(),
    body('seat_number').isNumeric(),
    body('email').isEmail()
], (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}, (req, res) => {
    const { user_id, show_id, seat_number, email } = req.body;

    // Fetch show details along with movie title
    const query = `
        SELECT 
            shows.total_seats, 
            shows.base_price, 
            shows.show_time, 
            movies.title AS movie_title
        FROM shows
        JOIN movies ON shows.movie_id = movies.id
        WHERE shows.id = ?
    `;

    db.query(query, [show_id], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length === 0) return res.status(404).send({ message: 'Show not found' });

        const show = results[0];
        if (!show.total_seats || !show.base_price || !show.show_time || !show.movie_title) {
            return res.status(500).send({ message: 'Invalid show data' });
        }

        const currentTime = new Date();
        const showTime = new Date(show.show_time);
        let price = show.base_price;

        db.query('SELECT COUNT(*) AS booked_seats FROM bookings WHERE show_id = ?', [show_id], (err, countResult) => {
            if (err) return res.status(500).send(err);

            const bookedSeats = countResult[0]?.booked_seats || 0;
            const seatOccupancy = (bookedSeats / show.total_seats) * 100;

            // Dynamic pricing logic
            if (seatOccupancy >= 70) price *= 1.3;
            if ((showTime - currentTime) / (1000 * 60 * 60) <= 3) price *= 1.2;
            if (currentTime.getHours() >= 19 && currentTime.getHours() <= 22) price *= 1.15;
            if (seatOccupancy < 30) price *= 0.8;

            price = parseFloat(price.toFixed(2)); // Round to two decimal places

            // Insert booking into the database
            db.query('INSERT INTO bookings (user_id, show_id, seat_number, price, email) VALUES (?, ?, ?, ?, ?)',
                [user_id, show_id, seat_number, price, email], (err, result) => {
                    if (err) return res.status(500).send(err);

                    // Send booking confirmation email
                    const mailOptions = {
                        from: 'no-reply@example.com', // Use a placeholder sender email
                        to: email,
                        subject: 'Booking Confirmation',
                        text: `Your seat has been booked successfully for Movie: ${show.movie_title} (Show ID: ${show_id}). Final Price: $${price}. Thank you for choosing us!`
                    };

                    transporter.sendMail(mailOptions, (emailErr, info) => {
                        if (emailErr) {
                            console.error('Error sending email:', emailErr);
                            return res.status(500).send({ message: 'Booking successful but email failed' });
                        }
                        console.log('Email sent:', info.response);
                        res.status(201).send({
                            message: 'Seat booked and email sent',
                            booking_id: result.insertId,
                            final_price: price,
                            movie_title: show.movie_title
                        });
                    });
                });
        });
    });
});

app.post('/simulate-pricing', (req, res) => {
    const { base_price, total_seats, booked_seats, show_time } = req.body;

    if (!base_price || !total_seats || !booked_seats || !show_time) {
        return res.status(400).send({ message: 'Missing required parameters' });
    }

    const currentTime = new Date();
    const showTime = new Date(show_time);
    let price = base_price;
    const seatOccupancy = (booked_seats / total_seats) * 100;

    // Apply dynamic pricing rules
    if (seatOccupancy >= 70) price *= 1.3;
    if ((showTime - currentTime) / (1000 * 60 * 60) <= 3) price *= 1.2;
    if (currentTime.getHours() >= 19 && currentTime.getHours() <= 22) price *= 1.15;
    if (seatOccupancy < 30) price *= 0.8;

    price = parseFloat(price.toFixed(2));
    res.status(200).send({ final_price: price });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
