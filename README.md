# 책날개

개인 독서 관리와 데스크톱 배경화면용 서가를 결합한 Windows 데스크톱 앱입니다.

## 개발 모드로 바로 실행

Node.js가 설치된 Windows에서 최초 한 번만 의존성을 설치합니다.

```powershell
npm.cmd install
```

그다음부터는 아래 명령 하나로 앱을 실행합니다.

```powershell
npm.cmd run dev
```

설치 프로그램과 포터블 실행 파일을 만들려면 다음 명령을 사용합니다.

```powershell
npm.cmd run build
```

완성된 파일은 `release` 폴더에 생성됩니다.

## 저장소

<https://github.com/suhakuijeongseok/Chaeknalgae>

도서와 기록은 브라우저의 `localStorage`에 저장됩니다. 배경화면 꾸미기에서 현재 서가를 PNG로 내려받을 수 있습니다.

## 구현 기능

- 읽는 중 / 읽고 싶은 / 완독 도서 관리와 상세 기록
- 개인 기록 기반 추천 도서와 서가 추가
- 예스24 Open API 및 제목·저자·출판사·ISBN·고화질 앞표지·책등·뒷표지 자동 입력
- 도서관 정보나루 도서 검색, ISBN 기반 마니아·다독자 추천
- 독서 타이머와 누적 시간
- 인상 깊은 문장 기록
- 완독량, 페이지, 주간 독서 시간, 독서 거리 시각화
- 배경화면 미리보기, 요소 크기 조절, PNG 저장 및 Windows 배경화면 즉시 적용
- 데스크톱과 모바일 반응형 화면

## 도서 API 서버 설정

배포 사용자에게 인증키를 요구하지 않습니다. Firebase Functions가 예스24 Open API와 도서관 정보나루 API를 대신 호출합니다.

```powershell
firebase functions:secrets:set YES24_API_KEY
firebase functions:secrets:set DATA4LIBRARY_KEY
firebase deploy --only functions
```

배포 후 출력된 함수 URL을 `app-config.json`의 `firebaseApiBaseUrl`에 입력합니다. 실제 인증키나 `.firebaserc` 파일은 Git에 커밋하지 않습니다.
