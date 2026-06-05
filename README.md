# PropManagerr

**Self-hosted UK landlord property management software for managing properties, tenants, rent, documents, repairs, expenses and compliance in one place.**

PropManagerr is a web-based property management platform designed for UK landlords who want control of their own data. It runs on your own server, NAS or hosting environment and includes an admin dashboard plus a tenant portal.

PropManagerr also includes a Windows desktop app that connects to your existing PropManagerr server.

---

## Why PropManagerr?

Many landlord tools are cloud-only, expensive, or not designed around small private landlords.

PropManagerr is being built as a practical self-hosted alternative for landlords who want:

- Property and tenant management
- Rent tracking
- Repair reporting
- Document storage
- Compliance awareness
- Expense tracking
- Tenant access
- Full control over hosting and data

---

## Current Features

### Admin Dashboard

- Portfolio overview
- Property status summary
- Rent collection overview
- Overdue rent visibility
- Compliance document reminders
- Recent repair tickets
- UK legal/compliance update section

### Property Management

- Add, edit and delete properties
- Track address, city, postcode, rent, bedrooms, property type and status
- Assign tenants to properties

### Tenant Management

- Add, edit and delete tenants
- Assign tenants to properties
- Track lease start and end dates
- Track payment status
- Manage tenant login accounts

### Rent Management

- View rent payments
- Edit payment status
- Track paid, pending and overdue rent
- Tenant portal rent view

### Documents & Compliance

- Upload property documents
- Upload tenant documents
- Upload global documents for all tenants
- View and delete documents
- Tenant access to assigned and global documents
- Track expiry dates for compliance documents

### Repairs & Maintenance

- Tenant repair reporting
- Admin repair management
- Track repair status
- Set urgency
- Add contractor, cost and notes
- Tenant repair history

### Expenses

- Expense tracking
- Expense categories
- Property-linked expenses
- Dashboard integration

### Tenant Portal

Tenants can log in and view:

- My property
- My tenancy
- My rent
- My documents
- My repairs

### Windows Desktop App

PropManagerr has an Electron-based Windows desktop app.

The desktop app does not replace the server. It connects to your existing PropManagerr web/API server and loads the hosted app inside a Windows desktop client.

---

## Screenshots

Screenshots coming soon.

Recommended screenshots to add:

1. Admin dashboard
2. Properties page
3. Tenant portal
4. Documents page
5. Repairs page
6. Windows desktop app

---

## Tech Stack

- React
- TypeScript
- Tailwind CSS
- Node.js
- Express
- PostgreSQL
- Docker
- TrueNAS SCALE custom app deployment
- Electron for Windows desktop client

---

## Installation

PropManagerr is designed to be self-hosted using Docker, Docker Compose or a TrueNAS SCALE custom app.

### Requirements

- Docker / Docker Compose, or TrueNAS SCALE
- PostgreSQL database
- Persistent storage for uploaded documents
- A reverse proxy such as Nginx Proxy Manager is optional but recommended for HTTPS

### Quick Start

Clone the repository:

```bash
git clone https://github.com/christianrobertson36/PropManagerr.git
cd PropManagerr