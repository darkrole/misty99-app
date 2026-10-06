require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI) {
  console.error('STARTUP ERROR: MONGO_URI is not set.');
  process.exit(1);
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('STARTUP ERROR: JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    balance: { type: Number, default: 100, min: 0 },
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    transactionHistory: [
      {
        actionType: String,
        amount: Number,
        timestamp: String,
      },
    ],
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function publicUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    balance: user.balance,
    role: user.role,
  };
}

function createToken(user) {
  return jwt.sign({ userId: String(user._id) }, JWT_SECRET, { expiresIn: '24h' });
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'misty99-app' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required.' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username may contain only letters, numbers and underscore.' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(409).json({
        error: existing.username === username ? 'Username already exists.' : 'Email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email,
      passwordHash,
      balance: 100,
      transactionHistory: [
        {
          actionType: 'register_bonus',
          amount: 100,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    res.status(201).json({ ok: true, token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const identity = String(req.body.emailOrUsername || '').trim();
    const password = String(req.body.password || '');

    if (!identity || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const user = await User.findOne({
      $or: [{ email: identity.toLowerCase() }, { username: identity }],
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    res.json({ ok: true, token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    console.error('ME ERROR:', error);
    res.status(500).json({ error: 'Could not load user.' });
  }
});

app.post('/api/game/spin', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const bet = Math.floor(Number(req.body.bet));
    if (!Number.isFinite(bet) || bet < 1) {
      return res.status(400).json({ error: 'Invalid bet amount.' });
    }
    if (bet > user.balance) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }

    const win = Math.random() < 0.48;
    const payout = win ? bet * 2 : 0;
    const net = payout - bet;

    user.balance += net;
    user.transactionHistory.push({
      actionType: win ? 'bet_won' : 'bet_lost',
      amount: Math.abs(net),
      timestamp: new Date().toISOString(),
    });

    await user.save();

    res.json({
      ok: true,
      message: win ? `You won ${payout} CR` : `You lost ${bet} CR`,
      balance: user.balance,
      bet,
      payout,
      net,
      color: win ? 'red' : 'black',
    });
  } catch (error) {
    console.error('SPIN ERROR:', error);
    res.status(500).json({ error: 'Game server error.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Misty99 server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('STARTUP ERROR: Could not connect to MongoDB.');
    console.error(error.message);
    process.exit(1);
  }
}

start();
