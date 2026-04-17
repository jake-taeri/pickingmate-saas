import React, { useState } from 'react';

export default function SignupForm() {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    password: '',
    confirmPassword: '',
    mallType: 'cafe24',
    mallId: '',
    phone: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Signup attempt:', formData);
      alert('회원가입이 완료되었습니다! (개발 중)');
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.');
    }
    
    setIsLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">피킹메이트</h2>
            <p style={{ color: '#bfdbfe', fontSize: '1.125rem' }}>신규 가입</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                업체명 *
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="예: 마켓플레이스"
              />
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                담당자명 *
              </label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="홍길동"
              />
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                이메일 *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="admin@company.com"
              />
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                연락처
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="010-1234-5678"
              />
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                쇼핑몰 타입 *
              </label>
              <select
                name="mallType"
                value={formData.mallType}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
              >
                <option value="cafe24" style={{color: 'black'}}>카페24</option>
                <option value="shopify" style={{color: 'black'}}>Shopify</option>
              </select>
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                쇼핑몰 ID *
              </label>
              <input
                type="text"
                name="mallId"
                value={formData.mallId}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="쇼핑몰 ID 또는 스토어명"
              />
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                비밀번호 *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="8"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="8자 이상 입력"
              />
            </div>

            <div>
              <label style={{ color: '#dbeafe', fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                비밀번호 확인 *
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '0.75rem',
                  color: 'white',
                  outline: 'none'
                }}
                placeholder="비밀번호 재입력"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: 'white',
                fontWeight: '600',
                padding: '1rem 1.5rem',
                borderRadius: '0.75rem',
                border: 'none',
                cursor: 'pointer',
                marginTop: '1.5rem',
                transition: 'all 0.2s',
                transform: 'translateY(0)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 15px 35px -5px rgba(0, 0, 0, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.3)';
              }}
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </button>

            <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <span style={{ color: '#bfdbfe' }}>이미 계정이 있으신가요? </span>
              <button
                type="button"
                onClick={() => window.location.href = '/'}
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
                로그인
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
