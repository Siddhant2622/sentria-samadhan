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
        process.exit(1);
    } else {
        console.log(`✅ Connected to SQLite at: ${dbPath}`);

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
                media_urls TEXT,
                work_updates TEXT,
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

            // Safe migrations — ignore errors if columns already exist
            db.run(`ALTER TABLE complaints ADD COLUMN due_date_updated INTEGER DEFAULT 0`, () => {});
            db.run(`ALTER TABLE users ADD COLUMN fcm_token TEXT`, () => {});

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
                related_complaints TEXT
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

            // Seed default users
            db.run(`INSERT OR IGNORE INTO users (id, name, phone, email, role, department, district, aadhaar_verified) VALUES
                ('admin-1', 'Admin Municipal Corp', '9999999999', 'admin@sentria.gov.in', 'Admin', 'MUNICIPAL_CORP', '', 1),
                ('officer-1', 'Rajesh Kumar', '8888888888', 'rajesh@pwd.gov.in', 'Officer', 'PWD', '', 1),
                ('citizen-1', 'Aarav Sharma', '7777777777', 'aarav@citizen.com', 'Citizen', '', '', 1)
            `);

            db.run(`UPDATE users SET department = 'PWD', name = 'Rajesh Kumar' WHERE id = 'officer-1' AND (department IS NULL OR department = '')`);

            // Seed demo campaigns
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

            // Seed demo donations
            db.run(`INSERT OR IGNORE INTO donations (id, campaign_id, donor_name, amount, currency, paypal_order_id, paypal_capture_id, status) VALUES
                ('don-d001', 'camp-001', 'Rahul Verma',   500,  'USD', 'PAYPAL-ORDER-001', 'CAP-001', 'completed'),
                ('don-d002', 'camp-001', 'Priya Sharma',  250,  'USD', 'PAYPAL-ORDER-002', 'CAP-002', 'completed'),
                ('don-d003', 'camp-001', 'Anonymous',     100,  'USD', 'PAYPAL-ORDER-003', 'CAP-003', 'completed'),
                ('don-d004', 'camp-001', 'Amit Joshi',   1000,  'USD', 'PAYPAL-ORDER-004', 'CAP-004', 'completed'),
                ('don-d005', 'camp-002', 'Neha Singh',    500,  'USD', 'PAYPAL-ORDER-005', 'CAP-005', 'completed'),
                ('don-d006', 'camp-002', 'Rohit Gupta',   750,  'USD', 'PAYPAL-ORDER-006', 'CAP-006', 'completed'),
                ('don-d007', 'camp-002', 'Sunita Patel',  250,  'USD', 'PAYPAL-ORDER-007', 'CAP-007', 'completed'),
                ('don-d008', 'camp-002', 'Anonymous',     600,  'USD', 'PAYPAL-ORDER-008', 'CAP-008', 'completed'),
                ('don-d009', 'camp-003', 'Green Bhopal', 1000,  'USD', 'PAYPAL-ORDER-009', 'CAP-009', 'completed')
            `);
        });
    }
});

module.exports = db;
