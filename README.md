# Movie-Ticket-Booking
It is a movie ticket booking system with dynamic pricing developed in node.js
# Overview
This project is a Movie Booking API built using Node.js and Express.js. It allows users to book movie tickets, manage shows and movies, and simulate dynamic pricing for tickets. The API supports user authentication, role-based access control, and integrates with a MySQL database for data management.
# Features
# User Authentication: 
Login functionality with JWT-based token generation.

# Role-Based Access Control: 
Separate roles for theater owners and regular users.

# Dynamic Pricing: 
Ticket prices are dynamically adjusted based on seat occupancy, show timing, and other factors.

# Email Notifications: 
Sends booking confirmation emails using Nodemailer.

# Rate Limiting: 
Prevents abuse by limiting the number of requests per user.
# Operations:

Add and retrieve movies.

Add and retrieve shows.

Book tickets.
# Prerequisites
Make sure you have the following installed:

1. Node.js (v12 or higher)

2. MySQL database

3. Environment variables configured in a .env file.
## Installation

Follow these steps to install and set up the project on your local machine:

### Prerequisites
Ensure you have the following installed:
- **Node.js** (v12 or higher)
- **MySQL** database
- A `.env` file configured with the necessary environment variables.

### Step-by-Step Instructions

1. **Clone the Repository**
git clone <repository-url>
cd <repository-folder>
3. **Install Dependencies**
Run the following command to install all required packages:
npm install

3. **Set Up Environment Variables**
Create a `.env` file in the root directory and add the following details:
PORT=3000
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASS=your-database-password
DB_NAME=your-database-name

JWT_SECRET=your-jwt-secret-key

5. **Start the Server**
Start the application using:
node index.js
The server will run at `http://localhost:3000`.
## API Endpoints

Below is a list of the available endpoints in the Movie Booking API:

---

### Health Check

#### **GET `/health`**
- **Description**: Checks if the API is running.
- **Response**:
{
"status": "API is running"
}

---

### Authentication

#### **POST `/login`**
- **Description**: Authenticates a user and returns a JWT token.
- **Request Body**:
{
"username": "string",
"password": "string",
"role": "theater | user"

}
- **Response**:
{
"token": "JWT-token",
"role": "theater_owner | user"
}---

### Movies

#### **POST `/movies`**
- **Description**: Adds a new movie (accessible only by theater owners).
- **Headers**: Requires authentication (`Bearer Token`).
- **Request Body**:
{
"title": "string",
"genre": "string",
"duration": number
}
- **Response**:
{
"message": "Movie added",
"id": movie_id
}
#### **GET `/movies`**
- **Description**: Retrieves a list of movies. Supports filtering by genre or title.
- **Query Parameters** (optional):
- `genre`: Filter movies by genre.
- `title`: Filter movies by title.
- **Response**:
[
{
"id": number,
"title": "string",
"genre": "string",
"duration": number,
...
}
]---

### Shows

#### **POST `/shows`**
- **Description**: Adds a new show for a specific movie (accessible only by theater owners).
- **Headers**: Requires authentication (`Bearer Token`).
- **Request Body**:
{
"movie_id": number,
"total_seats": number,
"base_price": number,
"show_time": "YYYY-MM-DD HH:mm:ss"
}
- **Response**:
{
"message": "Show added",
"id": show_id
}
#### **GET `/shows`**
- **Description**: Retrieves a list of shows. Supports filtering by movie ID.
- **Query Parameters** (optional):
- `movie_id`: Filter shows by movie ID.
- **Response**:
[
{
"id": number,
"movie_id": number,
...
}
]
---

### Bookings

#### **POST `/bookings`**
- **Description**: Books a ticket for a specific show.
- **Request Body**:
{
"user_id": number,
"show_id": number,
"seat_number": number,
"email": "string"
}
- **Response**:
{
"message": "Seat booked and email sent",
"booking_id": booking_id,
"final_price": price,
...
}
#### **POST `/simulate-pricing`**
- **Description**: Simulates dynamic ticket pricing based on seat occupancy and show timing (for testing purposes).
- **Request Body**:
{
"base_price": number,
"total_seats": number,
"booked_seats": number,
"show_time": "YYYY-MM-DD HH:mm:ss"
}
- **Response**:
{
"final_price": price
}
---

### Notes
1. Replace `Bearer Token` in the headers with the JWT token received after logging in.
2. Ensure proper role-based access control for endpoints restricted to theater owners.
## Database Schema

Below is the database schema used in the Movie Booking API. The database is built using **MySQL**, and the tables are designed to manage users, movies, shows, bookings, and more.

---

### 1. Users Table (`users`)
Stores information about all users (both regular users and theater owners).

| Column Name | Data Type     | Description                          |
|-------------|---------------|--------------------------------------|
| `id`        | INT (Primary) | Unique identifier for the user.      |
| `username`  | VARCHAR(255)  | The username of the user.            |
| `password`  | VARCHAR(255)  | The hashed password of the user.     |
| `role`      | ENUM('user', 'theater_owner') | Role of the user (regular user or theater owner). |

---

### 2. Movies Table (`movies`)
Stores information about all movies.

| Column Name | Data Type     | Description                          |
|-------------|---------------|--------------------------------------|
| `id`        | INT (Primary) | Unique identifier for the movie.     |
| `title`     | VARCHAR(255)  | Title of the movie.                  |
| `genre`     | VARCHAR(255)  | Genre of the movie (e.g., Action).   |
| `duration`  | INT           | Duration of the movie in minutes.    |

---

### 3. Shows Table (`shows`)
Stores information about all shows for specific movies.

| Column Name   | Data Type     | Description                                    |
|---------------|---------------|------------------------------------------------|
| `id`          | INT (Primary) | Unique identifier for the show.               |
| `movie_id`    | INT (Foreign) | Foreign key referencing `movies.id`.           |
| `total_seats` | INT           | Total number of seats available for the show. |
| `base_price`  | FLOAT         | Base price of a ticket for the show.          |
| `show_time`   | DATETIME      | Date and time of the show.                    |

---

### 4. Bookings Table (`bookings`)
Stores information about ticket bookings for shows.

| Column Name   | Data Type     | Description                                    |
|---------------|---------------|------------------------------------------------|
| `id`          | INT (Primary) | Unique identifier for the booking.            |
| `user_id`     | INT (Foreign) | Foreign key referencing `users.id`.            |
| `show_id`     | INT (Foreign) | Foreign key referencing `shows.id`.            |
| `seat_number` | INT           | Seat number booked by the user.               |
| `price`       | FLOAT         | Final price paid for the ticket.              |

---

### Relationships Between Tables

- **Users → Bookings**: A user can make multiple bookings.
- **Movies → Shows**: A movie can have multiple shows.
- **Shows → Bookings**: A show can have multiple bookings.

---

### Example SQL Queries to Create Tables

Here are sample SQL queries to create these tables:

#### Users Table
CREATE TABLE users (
id INT AUTO_INCREMENT PRIMARY KEY,
username VARCHAR(255) NOT NULL,
password VARCHAR(255) NOT NULL,
role ENUM('user', 'theater_owner') NOT NULL
);
#### Movies Table
CREATE TABLE movies (
id INT AUTO_INCREMENT PRIMARY KEY,
title VARCHAR(255) NOT NULL,
genre VARCHAR(255),
duration INT NOT NULL
);
#### Shows Table
CREATE TABLE shows (
id INT AUTO_INCREMENT PRIMARY KEY,
movie_id INT NOT NULL,
total_seats INT NOT NULL,
base_price FLOAT NOT NULL,
show_time DATETIME NOT NULL,
FOREIGN KEY (movie_id) REFERENCES movies(id)
);
#### Bookings Table
CREATE TABLE bookings (
id INT AUTO_INCREMENT PRIMARY KEY,
user_id INT NOT NULL,
show_id INT NOT NULL,
seat_number INT NOT NULL,
price FLOAT NOT NULL,
FOREIGN KEY (user_id) REFERENCES users(id),
FOREIGN KEY (show_id) REFERENCES shows(id)
);
