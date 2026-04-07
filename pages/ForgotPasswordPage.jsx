import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import authService from '../utils/authService';
import supabase from '../utils/supabaseClient';

function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(false);
    const [otpCode, setOtpCode] = React.useState('');
    const [verifying, setVerifying] = React.useState(false);
    const [resendCooldown, setResendCooldown] = React.useState(0);

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Cooldown timer for resend
    React.useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!email) {
            setError('Please enter your email address');
            return;
        }

        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            await authService.resetPassword(email);
            setSuccess(true);
            setResendCooldown(60);
        } catch (error) {
            console.error('Password reset error:', error);
            console.error('Error details:', error.message, error.status, error);
            
            // Show more specific error messages
            if (error.message?.includes('rate limit')) {
                setError('Too many attempts. Please wait a few minutes before trying again.');
            } else if (error.message?.includes('not found') || error.message?.includes('User')) {
                setError('If this email is registered, you will receive a password reset code.');
            } else if (error.message?.includes('Email')) {
                setError('Email service unavailable. Please contact support.');
            } else {
                setError(`Failed to send reset email: ${error.message || 'Please try again.'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setError(null);
        setLoading(true);
        try {
            await authService.resetPassword(email);
            setResendCooldown(60);
        } catch (error) {
            console.error('Resend error:', error);
            setError('Failed to resend code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError(null);

        const code = otpCode.trim();
        if (!code) {
            setError('Please enter the 6-digit code from your email');
            return;
        }

        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setVerifying(true);

        try {
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email: email,
                token: code,
                type: 'recovery',
            });

            if (verifyError) {
                throw verifyError;
            }

            if (data?.session) {
                // OTP verified successfully, user now has a valid session
                navigate('/reset-password?verified=true');
            } else {
                setError('Verification failed. Please try again or request a new code.');
            }
        } catch (error) {
            console.error('OTP verification error:', error);
            if (error.message?.includes('expired') || error.message?.includes('invalid')) {
                setError('Code has expired or is invalid. Please request a new one.');
            } else if (error.message?.includes('Token')) {
                setError('Invalid code. Please check and try again.');
            } else {
                setError(error.message || 'Verification failed. Please try again.');
            }
        } finally {
            setVerifying(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        <div className="text-center mb-6">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 mb-4">
                                <i className="fas fa-envelope text-primary-600 text-xl"></i>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Check your email
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                                We&apos;ve sent a 6-digit code to <strong>{email}</strong>
                            </p>
                            <p className="text-sm text-gray-500 mb-6">
                                Enter the code below to reset your password. The code expires in 1 hour.
                            </p>
                        </div>

                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                                    6-Digit Code
                                </label>
                                <input
                                    id="otp"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={otpCode}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setOtpCode(val);
                                        if (error) setError(null);
                                    }}
                                    placeholder="Enter 6-digit code"
                                    className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    autoFocus
                                    autoComplete="one-time-code"
                                />
                            </div>

                            {error && (
                                <div className="rounded-md bg-red-50 p-3">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <i className="fas fa-exclamation-circle text-red-400"></i>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-red-800">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full"
                                disabled={verifying || otpCode.length !== 6}
                            >
                                {verifying ? (
                                    <span className="flex items-center justify-center">
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        Verifying...
                                    </span>
                                ) : (
                                    'Verify Code'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center space-y-3">
                            <p className="text-sm text-gray-500">
                                Didn&apos;t receive the code? Check your spam folder.
                            </p>
                            <button
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || loading}
                                className={`text-sm font-medium transition-colors ${
                                    resendCooldown > 0
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'text-primary-600 hover:text-primary-500 cursor-pointer'
                                }`}
                            >
                                {loading ? (
                                    <><i className="fas fa-spinner fa-spin mr-1"></i> Sending...</>
                                ) : resendCooldown > 0 ? (
                                    `Resend code in ${resendCooldown}s`
                                ) : (
                                    <><i className="fas fa-redo mr-1"></i> Resend code</>
                                )}
                            </button>

                            <div className="border-t border-gray-200 pt-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-500"
                                >
                                    Back to login
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Reset your password
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Enter your email address and we'll send you a link to reset your password
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email address
                            </label>
                            <div className="mt-1">
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (error) setError(null);
                                    }}
                                    placeholder="Enter your email"
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <i className="fas fa-exclamation-circle text-red-400"></i>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-800">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <Button
                                type="submit"
                                variant="primary"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? 'Sending...' : 'Send reset link'}
                            </Button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-sm font-medium text-primary-600 hover:text-primary-500"
                            >
                                Back to login
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;
