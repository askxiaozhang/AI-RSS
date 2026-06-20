from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.core.database import get_session
from src.core.security import get_password_hash, verify_password, create_access_token, decode_access_token
from src.models.user import User, UserCreate, UserRead, Token

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> User:
    """Dependency to retrieve the logged-in user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
        
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, session: AsyncSession = Depends(get_session)):
    # Check if user already exists
    stmt = select(User).where(User.email == user_in.email)
    result = await session.execute(stmt)
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )
        
    db_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        preferred_language=user_in.preferred_language
    )
    session.add(db_user)
    await session.commit()
    await session.refresh(db_user)
    return db_user

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    stmt = select(User).where(User.email == form_data.username)
    result = await session.execute(stmt)
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return Token(access_token=access_token)

# ========== 后门登录（开发用） ==========
BACKDOOR_EMAIL = "admin@ai-rss.com"
BACKDOOR_PASSWORD = "admin123"

@router.post("/backdoor", response_model=Token)
async def backdoor_login(
    session: AsyncSession = Depends(get_session)
):
    """
    后门登录 - 开发/测试用
    直接使用固定账号密码登录，无需注册
    邮箱：admin@ai-rss.com
    密码：admin123
    """
    # 查找或创建后门用户
    stmt = select(User).where(User.email == BACKDOOR_EMAIL)
    result = await session.execute(stmt)
    user = result.scalars().first()

    if not user:
        # 自动创建后门用户
        user = User(
            email=BACKDOOR_EMAIL,
            hashed_password=get_password_hash(BACKDOOR_PASSWORD),
            preferred_language="zh"
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

    access_token = create_access_token(data={"sub": user.email})
    return Token(access_token=access_token)
