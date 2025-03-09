// File: transporter.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
        user: '81194057e51ea2',
        pass: 'e418d5856183b6'
    }
});

module.exports = transporter;
