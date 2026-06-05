import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserWithEmailAndPassword, type User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { Mail, Lock, User, Phone, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Change this — or move to VITE_ADMIN_SECRET_PIN in your .env
const ADMIN_SECRET_PIN = import.meta.env.VITE_ADMIN_SECRET_PIN ?? "ADMIN2024";

export default function AdminRegister() {
    const navigate = useNavigate();

    const [step, setStep] = useState<"pin" | "form">("pin");
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin !== ADMIN_SECRET_PIN) {
            toast.error("Invalid PIN. Access denied.");
            return;
        }
        setStep("form");
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const user: FirebaseUser = cred.user;

            await setDoc(doc(db, "users", user.uid), {
                firstName,
                lastName,
                phone,
                email,
                role: "admin",
                createdAt: serverTimestamp(),
            });

            toast.success("Admin account created!");
            navigate("/admin", { replace: true });
        } catch (error: unknown) {
            const code = (error as { code?: string })?.code;
            console.error("Admin register error:", code, error);
            if (code === "auth/email-already-in-use") {
                toast.error("This email is already registered.");
            } else if (code === "auth/weak-password") {
                toast.error("Password must be at least 6 characters.");
            } else if (code === "auth/network-request-failed") {
                toast.error("Network error. Please check your connection.");
            } else if (code === "auth/invalid-email") {
                toast.error("Please enter a valid email address.");
            } else {
                toast.error(`Registration failed: ${code ?? "unknown error"}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <Logo size="lg" className="justify-center mb-4" />
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <ShieldCheck className="w-5 h-5 text-destructive" />
                        <h1 className="text-2xl font-bold">Admin Registration</h1>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {step === "pin"
                            ? "Enter the admin secret PIN to continue"
                            : "Fill in the details for the new admin account"}
                    </p>
                </div>

                {step === "pin" ? (
                    <form onSubmit={handlePinSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="pin">Secret PIN</Label>
                            <div className="relative mt-1.5">
                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="pin"
                                    type={showPin ? "text" : "password"}
                                    placeholder="Enter admin PIN"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" size="lg">
                            Verify PIN
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            Not an admin?{" "}
                            <button
                                type="button"
                                onClick={() => navigate("/auth")}
                                className="text-primary font-medium hover:underline"
                            >
                                Go to login
                            </button>
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="firstName">First Name</Label>
                                <div className="relative mt-1.5">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="firstName"
                                        type="text"
                                        placeholder="John"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="lastName">Last Name</Label>
                                <div className="relative mt-1.5">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="lastName"
                                        type="text"
                                        placeholder="Doe"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="phone">Phone Number</Label>
                            <div className="relative mt-1.5">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+234 800 000 0000"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="email">Email</Label>
                            <div className="relative mt-1.5">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="password">Password</Label>
                            <div className="relative mt-1.5">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    autoComplete="new-password"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Creating admin account...
                                </>
                            ) : (
                                "Create Admin Account"
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}