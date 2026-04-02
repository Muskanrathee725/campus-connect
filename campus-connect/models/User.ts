import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  image: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  uid: {
    type: String,
    unique: true,
    sparse: true,
  },
  role: {
    type: String,
    enum: ["student", "alumni", "teacher"],
    default: "student",
  },
  year: String,
  branch: String,
  specialization: String,
  passingYear: String,
  techStack: [String],
  interests: [String],
  linkedin: String,
  github: String,
  twitter: String,
  company: String,
  onboardingComplete: {
    type: Boolean,
    default: false,
  },
   otp: String,
   otpExpiry: Date,
},
{
  timestamps: true,
});

delete (mongoose.models as any).User;
export default mongoose.model("User", UserSchema);