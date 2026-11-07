const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'sentria.db');
const dbDir = path.dirname(dbPath);

// Only try to create directory if it's a custom path (like /data/)
if (dbDir !== __dirname && !fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
        console.warn('Could not create DB directory, falling back to local:', e.message);
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ DATABASE ERROR:', err.message);
        process.exit(1); // Exit with error so Render shows it in logs
    } else {
        console.log(`✅ Connected to SQLite at: ${dbPath}`);
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                phone TEXT,
                email TEXT,
                role TEXT,
                aadhaar_verified INTEGER,
                trust_score INTEGER DEFAULT 100,
                is_banned INTEGER DEFAULT 0,
                ban_reason TEXT,
                profile_image TEXT,
                district TEXT,
                department TEXT,
                fcm_token TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS complaints (
                id TEXT PRIMARY KEY,
                citizen_id TEXT,
                title TEXT,
                description TEXT,
                category TEXT,
                status TEXT,
                progress_percentage INTEGER DEFAULT 0,
                priority_score INTEGER,
                urgency_level TEXT,
                latitude REAL,
                longitude REAL,
                upload_latitude REAL,
                upload_longitude REAL,
                address TEXT,
                ward_number TEXT,
                district TEXT,
                assigned_officer_id TEXT,
                assigned_officer_name TEXT,
                department_id TEXT,
                media_urls TEXT, -- Stored as JSON string
                work_updates TEXT, -- Stored as JSON string
                image_hash TEXT,
                reports_count INTEGER DEFAULT 1,
                is_fake INTEGER DEFAULT 0,
                fake_reason TEXT,
                expected_completion_date DATETIME,
                due_date_updated INTEGER DEFAULT 0,
                actual_completion_date DATETIME,
                delay_reason TEXT,
                escalation_level TEXT DEFAULT 'None',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (citizen_id) REFERENCES users(id),
                FOREIGN KEY (assigned_officer_id) REFERENCES users(id)
            )`);

            // Migration: add due_date_updated column if not exists
            db.run(`ALTER TABLE complaints ADD COLUMN due_date_updated INTEGER DEFAULT 0`, (err) => {
                // Ignore error if column already exists
            });

            db.run(`ALTER TABLE users ADD COLUMN fcm_token TEXT`, (err) => {
                // Ignore error if column already exists
            });

            db.run(`CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                citizen_id TEXT,
                complaint_id TEXT,
                rating INTEGER,
                comment TEXT,
                language TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (citizen_id) REFERENCES users(id),
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS warnings (
                id TEXT PRIMARY KEY,
                warning_type TEXT,
                area TEXT,
                ward TEXT,
                department TEXT,
                risk_level TEXT,
                confidence_score INTEGER,
                description TEXT,
                status TEXT DEFAULT 'Open',
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME,
                related_complaints TEXT -- Stored as JSON string of IDs
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS escalations (
                id TEXT PRIMARY KEY,
                complaint_id TEXT,
                action_taken TEXT,
                notes TEXT,
                escalation_level TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS district_admins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                district TEXT NOT NULL,
                state TEXT DEFAULT 'Madhya Pradesh',
                status TEXT DEFAULT 'Active',
                added_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Seed a default admin and officer if they don't exist
            db.run(`INSERT OR IGNORE INTO users (id, name, phone, email, role, department, district, aadhaar_verified) VALUES 
                ('admin-1', 'Admin Municipal Corp', '9999999999', 'admin@sentria.gov.in', 'Admin', 'MUNICIPAL_CORP', '', 1),
                ('officer-1', 'Rajesh Kumar', '8888888888', 'rajesh@pwd.gov.in', 'Officer', 'PWD', '', 1),
                ('citizen-1', 'Aarav Sharma', '7777777777', 'aarav@citizen.com', 'Citizen', '', '', 1)
            `);

            // Migration: fix existing officer-1 if it was seeded without department
            db.run(`UPDATE users SET department = 'PWD', name = 'Rajesh Kumar' WHERE id = 'officer-1' AND (department IS NULL OR department = '')`);

            // ── Community Campaigns (PayPal Hackathon) ──────────────
            db.run(`CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                goal_amount REAL NOT NULL,
                raised_amount REAL DEFAULT 0,
                category TEXT,
                organizer_name TEXT,
                status TEXT DEFAULT 'Active',
                image_url TEXT,
                related_complaint_ids TEXT,
                ai_summary TEXT,
                verified INTEGER DEFAULT 1,
                end_date DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS donations (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                donor_name TEXT DEFAULT 'Anonymous',
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                paypal_order_id TEXT,
                paypal_capture_id TEXT,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Seed demo campaigns for hackathon demo
            db.run(`INSERT OR IGNORE INTO campaigns (id, title, description, goal_amount, raised_amount, category, organizer_name, status, verified, end_date) VALUES
                ('camp-001', 'MP Nagar Road Repair Drive',
                 'Community-funded initiative to fix 12 potholes on MP Nagar Zone 2 Main Road, identified through 47 citizen complaints analysed by Sentria AI.',
                 5000, 1850, 'Roads', 'MP Citizens Welfare Trust', 'Active', 1, datetime('now', '+30 days')),
                ('camp-002', 'Habibganj Streetlight Restoration',
                 'Fund LED streetlights for 3 dark lanes near Habibganj school zone. AI analysis of 23 complaints flagged this as a safety emergency requiring urgent funding.',
                 2500, 2100, 'Electricity', 'Bhopal Safe Streets NGO', 'Active', 1, datetime('now', '+15 days')),
                ('camp-003', 'TT Nagar Park Cleanliness Drive',
                 'Monthly sanitation campaign for TT Nagar public park. Funds cover waste collection equipment and 2 dedicated sanitation workers for 3 months.',
                 1000, 1000, 'Sanitation', 'Green Bhopal Foundation', 'Completed', 1, datetime('now', '-5 days'))
            `);

        });
    }
});

module.exports = db;
