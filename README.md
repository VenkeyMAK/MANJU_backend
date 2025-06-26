# Manju Mobiles Backend API

This is the backend API for Manju Mobiles, a full-featured e-commerce platform built with Node.js, Express, and MongoDB. It includes complete functionality for product management, user authentication, order processing, and a sophisticated 100-level MLM (Multi-Level Marketing) and referral system.

# Create Admin
http://localhost:5000/api/admin/create-admin
header
{
    "Content-Type": "application/json"
    x-auth-token": "admin_token"
}
 body
{
    "name": "Admin",
    "email": "admin@admin.com",
    "password": "admin"
}

## Features

- **Product Management**: Full CRUD operations for products and accessories.
- **Advanced Filtering**: Filter products by brand, specs, and other attributes.
- **User Authentication**: Secure user registration and login with JWT (JSON Web Tokens), including Google OAuth.
- **Order Processing**: Create and manage orders with email confirmations.
- **User Profiles**: Manage user data, addresses, wishlists, and carts.
- **MLM & Referral System**: A 100-level referral system to incentivize users and drive sales.
- **Wallet System**: Users earn cashback and commissions, which are stored in their personal wallet.

---

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Authentication**: JSON Web Tokens (JWT), Google OAuth
- **Email**: Nodemailer with SMTP
- **File Uploads**: Multer

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) installed and running.

### Installation & Configuration

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd MANJU_backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create and configure the environment file:**
    -   Rename the `.env.example` file to `.env`.
    -   Open the `.env` file and fill in your specific credentials:

    ```env
    # Server Configuration
    PORT=5000

    # Database
    MONGO_URI=mongodb://localhost:27017/manju_mobiles

    # JWT Secret
    JWT_SECRET=YOUR_VERY_SECRET_KEY_HERE

    # Google OAuth Credentials
    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

    # Email SMTP Configuration (Hostinger Example)
    EMAIL_HOST=smtp.hostinger.com
    EMAIL_PORT=465
    EMAIL_USER=your_email@example.com
    EMAIL_PASSWORD=your_email_password
    ```

4.  **Start the development server:**
    ```bash
    npm run dev:backend
    ```
    The server will start on the port specified in your `.env` file (default: 5000).

---

## MLM & Referral System Explained

The core of the incentive program is a 100-level MLM system designed to reward both buyers and their referrers.

### How It Works

1.  **Referral**: Every user gets a unique referral code. When a new user (User B) signs up using an existing user's code (User A), a referral link is established. User A is now in User B's "upline."

2.  **Purchase**: When User B makes a purchase, the system calculates the profit margin on that order.

3.  **Commission Split**: The profit margin is split:
    -   **50%** is retained by the company.
    -   The remaining **50%** is split equally:
        -   **50%** goes to the buyer (User B) as instant cashback.
        -   **50%** is distributed among the upline (User A and their referrers) as commission.

### Commission Structure

The commission pool is distributed to the 100-level upline based on the following percentages:

| Level | Commission Rate |
| :---- | :-------------- |
| 1     | 10%             |
| 2     | 8%              |
| 3     | 6%              |
| 4     | 5%              |
| 5     | 4%              |
| 6-10  | 3%              |
| 11-30 | 1%              |
| 31-60 | 0.5%            |
| 61-100| 0.2%            |

-   **Minimum Payout**: To avoid micro-transactions, a commission is only paid if it is at least **₹0.10**.

---

## Example API Usage (Postman)

Here’s how to test the complete referral flow.

#### 1. Register User A (The Referrer)

-   **Method**: `POST`
-   **URL**: `http://localhost:5000/api/auth/register`
-   **Body** (`raw`, `JSON`):
    ```json
    {
        "name": "User A",
        "email": "usera@example.com",
        "password": "password123"
    }
    ```

#### 2. Login as User A & Get Their Referral Code

-   First, log in to get the auth token:
    -   **Method**: `POST`
    -   **URL**: `http://localhost:5000/api/auth/login`
    -   **Body**: `{"email": "usera@example.com", "password": "password123"}`
-   Then, get the referral code:
    -   **Method**: `GET`
    -   **URL**: `http://localhost:5000/api/referral/code`
    -   **Headers**: `x-auth-token`: `[Paste User A's Token Here]`

#### 3. Register User B (Referred by User A)

-   **Method**: `POST`
-   **URL**: `http://localhost:5000/api/auth/register`
-   **Body** (`raw`, `JSON`):
    ```json
    {
        "name": "User B",
        "email": "userb@example.com",
        "password": "password456",
        "referrerCode": "[Paste User A's Referral Code Here]"
    }
    ```

#### 4. User B Places an Order

-   First, log in as User B to get their auth token.
-   Then, create the order:
    -   **Method**: `POST`
    -   **URL**: `http://localhost:5000/api/orders`
    -   **Headers**: `x-auth-token`: `[Paste User B's Token Here]`
    -   **Body** (`raw`, `JSON`):
        ```json
        {
            "orderNumber": "ORD12345",
            "items": [
                {
                    "productId": "some_product_id",
                    "name": "Awesome Phone",
                    "price": 20000,
                    "quantity": 1,
                    "cost": 15000
                }
            ],
            "total": 20000,
            "email": "userb@example.com",
            "mobile": "9876543210",
            "address": "123 Referral Street"
        }
        ```

#### 5. Check Wallets

-   **Check User B's Wallet (for cashback)**:
    -   **Method**: `GET`
    -   **URL**: `http://localhost:5000/api/wallet/balance`
    -   **Headers**: `x-auth-token`: `[User B's Token]`

-   **Check User A's Wallet (for commission)**:
    -   **Method**: `GET`
    -   **URL**: `http://localhost:5000/api/wallet/balance`
    -   **Headers**: `x-auth-token`: `[User A's Token]`
