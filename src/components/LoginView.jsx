import React, { useState } from 'react';

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      console.log('Login attempt:', { email, password });
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #1e40af 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1rem'
    }}>
      <div className="max-w-md w-full space-y-8">
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '1.5rem',
          padding: '2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          <div className="text-center mb-8">
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              borderRadius: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
            }}>
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">피킹메이트</h2>
            <p style={{ color: '#bfdbfe', fontSize: '1.125rem' }}>스마트 창고 관리 시스템</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label style={{ 
                color: '#dbeafe', 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '0.75rem' 
              }}>
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontSize: '1rem'
                }}
                placeholder="admin@pickingmate.com"
                required
                disabled={loading}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.border = '1px solid rgba(255, 255, 255, 0.6)';
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.border = '1px solid rgba(255, 255, 255, 0.4)';
                }}
              />
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <label style={{ 
                color: '#dbeafe', 
                fontSize: '0.875rem', 
                fontWeight: '600', 
                display: 'block', 
                marginBottom: '0.75rem' 
              }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none',
                  transition: 'all 0.2s',
                  fontSize: '1rem'
                }}
                placeholder="비밀번호를 입력하세요"
                required
                disabled={loading}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.border = '1px solid rgba(255, 255, 255, 0.6)';
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                  e.target.style.border = '1px solid rgba(255, 255, 255, 0.4)';
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fecaca',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                marginTop: '1rem'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white',
                fontWeight: '600',
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                transform: 'translateY(0)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                marginTop: '2.5rem',
                fontSize: '1rem'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 15px 35px -5px rgba(0, 0, 0, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
              }}
              disabled={loading || !email || !password}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <div style={{ 
              textAlign: 'center', 
              paddingTop: '2rem', 
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              marginTop: '2.5rem'
            }}>
              <span style={{ color: '#bfdbfe' }}>아직 계정이 없으신가요? </span>
              <button
                type="button"
                onClick={() => window.location.href = '/signup'}
                style={{
                  color: '#60a5fa',
                  fontWeight: '600',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.target.style.color = '#93c5fd'}
                onMouseOut={(e) => e.target.style.color = '#60a5fa'}
              >
                회원가입하기
              </button>
            </div>
          </form>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(147, 197, 253, 0.6)', fontSize: '0.875rem' }}>
            © 2024 피킹메이트 | 와캠핑 제공
          </p>
        </div>
      </div>
    </div>
  );
}
