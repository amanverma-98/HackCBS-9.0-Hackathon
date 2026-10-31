const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { ROLES } = require("../config/roles");

const SALT_ROUNDS = 12;

const onboardingSchema = new mongoose.Schema(
  {
    completed: { type: Boolean, default: false },
    phone: { type: String, trim: true, maxlength: 20 },
    city: { type: String, trim: true, maxlength: 80 },
    skills: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    availability: {
      type: String,
      enum: ["anytime", "weekdays", "weekends", "on_call"],
    },
    completedAt: Date,
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: "citizen" },
    onboarding: { type: onboardingSchema, default: () => ({}) },
  },
  { timestamps: true },
);

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.matchPassword = function matchPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const { _id, name, email, role, onboarding, createdAt } = this.toObject();
  return { id: _id, name, email, role, onboarding, createdAt };
};

module.exports = mongoose.model("User", userSchema);
