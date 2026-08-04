/**
 * Thai is the source of truth — `Dictionary` is inferred from it, so adding a
 * key to `th` without adding it to `en` is a type error.
 */

export const th = {
  brand: {
    name: "Find KU Dae",
    tagline: "หารูปตัวเองจากงานอีเวนต์",
  },

  nav: {
    home: "หน้าแรก",
    events: "งานอีเวนต์",
    forPhotographers: "สำหรับช่างภาพ",
    studio: "สตูดิโอ",
    admin: "ผู้ดูแล",
    profile: "โปรไฟล์",
    signIn: "เข้าสู่ระบบ",
    signOut: "ออกจากระบบ",
    switchLanguage: "English",
    skipToContent: "ข้ามไปยังเนื้อหา",
  },

  home: {
    headline: "หารูปคุณ ในกองรูปทั้งงาน",

    finderLabel: "ใส่รหัสงาน 6 ตัว",
    finderSubmit: "เปิดงาน",
    /** พิมพ์เล็กพิมพ์ใหญ่ไม่ต่างกัน เลยไม่ต้องบอกให้เป็นภาระคนอ่าน */
    finderHint: "ตัวอักษรอังกฤษกับตัวเลข หรือวางลิงก์งานลงไปก็ได้",
    /** อ่านให้ screen reader ฟังทีละช่อง */
    finderSlotLabel: "รหัสงาน ตัวที่ {n} จาก {total}",
    finderNotFound: "ไม่พบงานนี้ ลองตรวจลิงก์หรือรหัสอีกครั้ง",
    finderEmpty: "ใส่ลิงก์หรือรหัสงานก่อน",
    finderUnavailable: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่",
    sub: "สแกน QR ที่งาน หรือเปิดลิงก์ที่ช่างภาพแชร์ แล้วให้ระบบหาหน้าคุณให้ ไม่ต้องไถดูทีละรูป",
    ctaPrimary: "ค้นหารูปของฉัน",
    ctaSecondary: "ฉันเป็นช่างภาพ",
    scanHint: "หรือสแกน QR ที่บูธถ่ายรูปในงาน",

    scrollCue: "เลื่อนลงเพื่อดูว่าทำงานยังไง",
    skipToSearch: "ไปหางานของคุณ",

    journeyTitle: "จากหน้าคุณ ถึงรูปคุณ",
    journeyLede: "เลื่อนลงเพื่อดูทีละขั้น",
    journey: [
      {
        title: "ถ่ายหน้าตัวเองครั้งเดียว",
        body: "จัดหน้าให้อยู่ในกรอบแล้วกดถ่าย ไม่ต้องสมัครสมาชิก รูปนี้ใช้แค่รอบนี้แล้วถูกลบทิ้ง",
      },
      {
        title: "ระบบไล่หาใบหน้าในรูปทั้งงาน",
        body: "รูปเป็นพันใบถูกไล่ดูทีละใบ ทุกใบหน้าที่เจอจะถูกจับกรอบไว้ ใช้เวลาไม่กี่วินาที",
      },
      {
        title: "ได้เฉพาะรูปที่มีคุณ",
        body: "รูปที่หน้าตรงกับคุณจะถูกดึงออกมา โหลดได้เต็มความละเอียดเท่าที่ช่างภาพอัปโหลดมา",
      },
    ],
    journeyScanning: "กำลังไล่หา",
    journeyFound: "เจอแล้ว",

    finderHeading: "หางานที่คุณไป",

    demoMatch: "ตรงกับคุณ",
    demoCaption:
      "ภาพสาธิตการทำงาน กรอบในภาพวางไว้เพื่อแสดงตัวอย่าง ไม่ใช่ผลลัพธ์จริงจากระบบ",
    demoAlt:
      "รูปจากงานอีเวนต์ของมหาวิทยาลัย มีกรอบล้อมรอบใบหน้าแต่ละคนเพื่อแสดงว่าระบบหาใบหน้าเจอ",
    selfieAlt: "ภาพวาดใบหน้าคนกำลังถูกสแกน มีกรอบล้อมรอบใบหน้า",

    stepsTitle: "ใช้งานยังไง",
    stepsLede: "สามขั้น จบใน 30 วินาที",
    steps: [
      {
        label: "เปิดงาน",
        title: "สแกน QR หรือกดลิงก์",
        body: "ช่างภาพจะติด QR ไว้ที่บูธ หรือแชร์ลิงก์ในกลุ่มงาน เปิดแล้วเห็นรูปทั้งงานทันที",
      },
      {
        label: "ให้หน้า",
        title: "ถ่ายเซลฟี่ครั้งเดียว",
        body: "ถ่ายหรืออัปโหลดรูปหน้าตรง ถ้าล็อกอินไว้แล้ว ระบบใช้รูปที่บันทึกไว้ให้เลย ไม่ต้องถ่ายซ้ำทุกงาน",
      },
      {
        label: "โหลด",
        title: "ได้รูปที่มีคุณอยู่",
        body: "เจอกี่รูปโหลดได้หมด ไฟล์เต็มความละเอียดเท่าที่ช่างภาพอัปโหลดมา",
      },
    ],

    // Visitor-facing stat labels. Deliberately not reusing the studio's
    // wording — "ใบหน้าที่ index แล้ว" is operator jargon.
    statEvents: "งานที่ค้นได้",
    statPhotos: "รูปในระบบ",
    statFaces: "ใบหน้าที่ค้นเจอได้",

    eventsTitle: "งานที่เปิดให้ค้นตอนนี้",
    eventsEmpty: "ยังไม่มีงานที่เปิดให้ค้นหา",
    eventsEmptyBody: "งานจะขึ้นที่นี่หลังช่างภาพอัปโหลดรูปและผู้ดูแลอนุมัติ",
    viewAllEvents: "ดูงานทั้งหมด",

    privacyTitle: "ใบหน้าคือข้อมูลอ่อนไหว เราจัดการแบบนี้",
    privacyPoints: [
      {
        title: "ค้นแบบไม่สมัคร รูปไม่ถูกเก็บ",
        body: "เซลฟี่ที่คุณอัปโหลดถูกลบทิ้งทันทีที่ผลการค้นหาขึ้น ไม่มีสำเนาเหลือในระบบ",
      },
      {
        title: "ค้นแบบมีบัญชี เก็บรูปเดียว ลบเองได้",
        body: "เราเก็บรูปหน้าอ้างอิงของคุณไว้ใบเดียวเพื่อไม่ต้องถ่ายซ้ำทุกงาน กดลบได้ตลอดเวลาในหน้าโปรไฟล์",
      },
      {
        title: "เทียบเฉพาะงานที่คุณเปิด",
        body: "ข้อมูลใบหน้าของแต่ละงานแยกกันคนละชุด ระบบไม่เอาหน้าคุณไปไล่หาข้ามงานที่คุณไม่ได้เปิด",
      },
    ],
    privacyLink: "อ่านนโยบายความเป็นส่วนตัวฉบับเต็ม",
  },

  event: {
    photosCount: "รูปทั้งหมด",
    findMe: "ค้นหารูปของฉัน",
    browseAll: "ไถดูทั้งงาน",
    by: "ถ่ายโดย",
    notFound: "ไม่พบงานนี้",
    notFoundBody: "ลิงก์อาจหมดอายุ พิมพ์ผิด หรือช่างภาพยังไม่เปิดให้ค้นหา",
    pendingTitle: "งานนี้ยังไม่เปิด",
    pendingBody: "ผู้ดูแลกำลังตรวจสอบอยู่ กลับมาดูใหม่อีกครั้ง",
    accessCodeTitle: "งานนี้ต้องใส่รหัส",
    accessCodeBody: "ใส่รหัสที่ช่างภาพให้มาเพื่อดูรูปในงาน",
    accessCodeLabel: "รหัสเข้างาน",
    accessCodeSubmit: "เข้าดูรูป",
    accessCodeWrong: "รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง",
    galleryEmpty: "ยังไม่มีรูปในงานนี้",
    galleryEmptyBody: "ช่างภาพยังไม่ได้อัปโหลด กลับมาดูใหม่หลังงานจบ",
    indexing: "กำลังประมวลผลใบหน้า",
    indexingBody: "อีก {count} รูปกำลังประมวลผล ผลการค้นหาอาจยังไม่ครบ",
  },

  search: {
    title: "ค้นหารูปของคุณ",
    lede: "ระบบจะเทียบใบหน้าของคุณกับรูปในงานนี้เท่านั้น",

    savedFaceTitle: "ใช้หน้าที่บันทึกไว้",
    savedFaceBody: "ค้นได้เลย ไม่ต้องถ่ายใหม่",
    savedFaceCta: "ค้นด้วยหน้าที่บันทึกไว้",

    uploadTitle: "ถ่ายหรืออัปโหลดเซลฟี่",
    uploadBody: "ใช้ครั้งเดียวสำหรับการค้นนี้ ไม่บันทึกเก็บไว้",
    uploadCta: "เลือกรูป",
    uploadRetake: "เลือกรูปใหม่",
    uploadCamera: "ถ่ายด้วยกล้อง",

    signInPrompt: "อยากไม่ต้องถ่ายซ้ำทุกงาน?",
    signInPromptBody: "เข้าสู่ระบบแล้วบันทึกรูปหน้าไว้ครั้งเดียว ใช้ค้นได้ทุกงาน",

    consentLabel:
      "ฉันยินยอมให้ประมวลผลภาพใบหน้าเพื่อค้นหารูปของฉันในงานนี้ และเข้าใจว่าใบหน้าเป็นข้อมูลอ่อนไหวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล",
    consentRequired: "ต้องยินยอมก่อนจึงจะค้นหาได้",
    consentReadPolicy: "อ่านรายละเอียดการเก็บข้อมูล",

    submit: "ค้นหา",
    scanning: "กำลังเทียบใบหน้า",
    scanningBody: "ใช้เวลาไม่กี่วินาที",

    tipsTitle: "รูปแบบไหนได้ผลดีที่สุด",
    tips: [
      "หน้าตรง เห็นทั้งใบหน้า",
      "แสงพอ ไม่ย้อนแสง",
      "มีคนเดียวในรูป",
      "ไม่ใส่แว่นกันแดดหรือหน้ากาก",
    ],

    errorNoFace: "ไม่พบใบหน้าในรูปนี้ ลองรูปที่เห็นหน้าชัดกว่านี้",
    errorManyFaces: "รูปนี้มีหลายคน ใช้รูปที่มีคุณคนเดียว",
    errorTooLarge: "ไฟล์ใหญ่เกินไป ใช้รูปที่เล็กกว่า 10 MB",
    errorBadFormat: "รองรับเฉพาะไฟล์ JPEG, PNG และ WebP",
    errorGeneric: "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง",
    errorRateLimited: "ค้นหาบ่อยเกินไป รออีกสักครู่แล้วลองใหม่",
  },

  results: {
    title: "เจอ {count} รูปที่มีคุณ",
    titleZero: "ไม่เจอรูปที่มีคุณ",
    zeroBody:
      "อาจเป็นเพราะช่างภาพยังอัปโหลดไม่ครบ หรือรูปเซลฟี่ที่ใช้ค้นไม่ชัดพอ ลองใหม่ด้วยรูปที่เห็นหน้าตรงกว่านี้",
    zeroRetry: "ลองรูปอื่น",
    zeroBrowse: "ไถดูรูปทั้งงานเอง",
    match: "ตรง {percent}%",
    downloadOne: "โหลดรูปนี้",
    downloadAll: "โหลดทั้งหมด ({count})",
    downloading: "กำลังเตรียมไฟล์",
    searchAgain: "ค้นใหม่",
    watermarkNote: "รูปจากงานนี้ติดลายน้ำของช่างภาพ",
  },

  profile: {
    title: "โปรไฟล์",
    savedFaceTitle: "รูปหน้าที่บันทึกไว้",
    savedFaceNone: "ยังไม่ได้บันทึกรูปหน้า",
    savedFaceNoneBody:
      "บันทึกไว้ครั้งเดียวแล้วใช้ค้นได้ทุกงาน โดยไม่ต้องอัปโหลดซ้ำ",
    savedFaceAdd: "บันทึกรูปหน้า",
    savedFaceReplace: "เปลี่ยนรูป",
    savedFaceDelete: "ลบรูปหน้าออกจากระบบ",
    savedFaceDeleteConfirm:
      "ลบรูปหน้าที่บันทึกไว้? หลังลบแล้วต้องอัปโหลดเซลฟี่ใหม่ทุกครั้งที่ค้นหา",
    savedFaceDeleted: "ลบรูปหน้าแล้ว",
    savedFaceStored: "บันทึกเมื่อ {date}",

    historyTitle: "ประวัติการค้นหา",
    historyEmpty: "ยังไม่มีประวัติการค้นหา",

    consentTitle: "ความยินยอม",
    consentGranted: "ให้ความยินยอมเมื่อ {date}",
    consentWithdraw: "ถอนความยินยอม",
    consentWithdrawBody:
      "ถอนแล้วเราจะลบรูปหน้าที่บันทึกไว้ และคุณจะค้นหาด้วยใบหน้าไม่ได้จนกว่าจะยินยอมใหม่",

    dangerTitle: "ลบบัญชี",
    dangerBody:
      "ลบบัญชี รูปหน้า และประวัติการค้นหาทั้งหมดอย่างถาวร รูปที่ช่างภาพถ่ายในงานไม่ถูกลบ เพราะเป็นผลงานของช่างภาพ",
    dangerCta: "ลบบัญชีถาวร",
  },

  photographer: {
    applyTitle: "สมัครเป็นช่างภาพ",
    applyLede:
      "กรอกข้อมูลแล้วรอผู้ดูแลอนุมัติ อนุมัติแล้วจะสร้างงานและอัปโหลดรูปได้",
    displayName: "ชื่อที่แสดง",
    displayNameHint: "ชื่อนี้จะขึ้นใต้รูปทุกใบที่คุณอัปโหลด",
    affiliation: "สังกัด",
    affiliationHint: "คณะ ชมรม หรือทีมที่คุณถ่ายให้",
    bio: "แนะนำตัว",
    contactEmail: "อีเมลติดต่อ",
    contactPhone: "เบอร์ติดต่อ",
    submit: "ส่งใบสมัคร",
    statusPending: "รอผู้ดูแลตรวจสอบ",
    statusPendingBody: "ปกติใช้เวลาไม่เกิน 1-2 วัน",
    statusRejected: "ใบสมัครไม่ผ่าน",
    statusRejectedReason: "เหตุผล",
  },

  studio: {
    title: "สตูดิโอ",
    newEvent: "สร้างงานใหม่",
    eventsEmpty: "ยังไม่มีงาน",
    eventsEmptyBody: "สร้างงานแรก อัปโหลดรูป แล้วส่งให้ผู้ดูแลอนุมัติ",

    formNameTh: "ชื่องาน (ไทย)",
    formNameEn: "ชื่องาน (อังกฤษ)",
    formSlug: "ลิงก์งาน",
    formSlugHint: "ใช้เป็น URL และปลายทางของ QR code",
    formDescription: "รายละเอียด",
    formLocation: "สถานที่",
    formEventDate: "วันที่จัดงาน",
    formCover: "รูปปกงาน",
    formCoverClear: "ยกเลิกรูปนี้",
    formCoverHint:
      "JPEG, PNG หรือ WebP ไม่เกิน 10 MB · ไม่ใส่ก็ได้ ระบบจะใช้รูปแรกที่อัปโหลดแทน",
    formErrorCoverTooLarge: "รูปปกใหญ่เกินไป ใช้ไฟล์ที่เล็กกว่า 10 MB",
    formErrorCoverBadFormat: "รูปปกต้องเป็น JPEG, PNG หรือ WebP เท่านั้น",
    formPrivate: "งานส่วนตัว",
    formPrivateHint:
      "ไม่ขึ้นในรายการงานสาธารณะ และต้องใส่รหัสเข้างานก่อนถึงจะดูรูปได้",
    formPin: "รหัสเข้างาน 6 หลัก",
    formPinHint:
      "ตัวเลขล้วน · ให้เฉพาะคนที่ควรเข้าดูได้ · ระบบเก็บแบบเข้ารหัส ดูย้อนหลังไม่ได้ ถ้าลืมต้องตั้งใหม่",
    formPinSlot: "รหัสเข้างาน หลักที่ {n} จาก {total}",
    formPinRandom: "สุ่มให้",
    formErrorPinRequired: "งานส่วนตัวต้องตั้งรหัสเข้างาน 6 หลัก",
    formAccessCode: "รหัสงาน",
    /* ระบบออกให้เอง ตั้งเองไม่ได้ — เห็นได้อย่างเดียวเพื่อเอาไปพิมพ์ใต้ QR */
    formAccessCodeHint: "ระบบออกรหัสนี้ให้อัตโนมัติ เอาไปพิมพ์ไว้ใต้ QR ที่บูธได้เลย",
    formStatusDraft: "ยังเป็นร่าง ยังไม่มีใครเห็น",
    formStatusPending: "ส่งให้ผู้ดูแลแล้ว รอผลอนุมัติ",
    formStatusApproved: "เปิดให้ค้นหาแล้ว",
    formStatusRejected: "ผู้ดูแลไม่อนุมัติ",
    formCreate: "สร้างงาน",
    formErrorInvalid: "กรอกข้อมูลไม่ครบหรือไม่ถูกต้อง ตรวจอีกครั้ง",
    formErrorSlugTaken: "ลิงก์นี้ถูกใช้ไปแล้ว ลองตั้งชื่อลิงก์ใหม่",
    formErrorUnavailable: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
    eventsCount: "{count} งาน",
    photosInEvent: "{count} รูป",
    backToStudio: "กลับไปสตูดิโอ",
    openPublicPage: "ดูหน้างานจริง",
    qrPrint: "หน้าพร้อมพิมพ์",
    printScanTitle: "หารูปตัวเองจากงานนี้",
    printScanBody: "สแกน QR หรือเข้า {url} แล้วกรอกรหัส",
    printButton: "สั่งพิมพ์",
    formSave: "บันทึก",
    formSubmitForReview: "ส่งให้ผู้ดูแลอนุมัติ",

    watermarkTitle: "ลายน้ำ",
    watermarkLede: "ตั้งค่าต่องาน ลายน้ำจะถูกฝังตอนผู้ใช้กดโหลดรูป",
    watermarkEnabled: "ติดลายน้ำบนรูปที่โหลด",
    watermarkText: "ข้อความลายน้ำ",
    watermarkLogo: "โลโก้ลายน้ำ (PNG พื้นหลังโปร่ง)",
    watermarkPosition: "ตำแหน่ง",
    watermarkOpacity: "ความทึบ",
    watermarkScale: "ขนาด",
    watermarkPreview: "ตัวอย่าง",
    watermarkPositions: {
      bottom_right: "ขวาล่าง",
      bottom_left: "ซ้ายล่าง",
      top_right: "ขวาบน",
      top_left: "ซ้ายบน",
      center: "กลางภาพ",
      tiled: "ปูทั้งภาพ",
    },

    uploadTitle: "อัปโหลดรูป",
    uploadDrop: "ลากไฟล์มาวาง หรือกดเลือกไฟล์",
    uploadHint: "JPEG, PNG หรือ WebP อัปโหลดพร้อมกันได้หลายไฟล์",
    uploadQueue: "คิวอัปโหลด",
    uploadDone: "อัปโหลดแล้ว {done} จาก {total}",
    uploadCta: "เลือกไฟล์",
    uploadRetry: "ลองใหม่เฉพาะที่ไม่สำเร็จ",
    uploadComplete: "อัปโหลดครบแล้ว",
    uploadStaged: "เลือกไว้ {count} ไฟล์",
    uploadSelectAll: "เลือกทั้งหมด",
    uploadRemoveSelected: "เอาออก {count} ไฟล์",
    uploadRemoveOne: "เอาออก",
    uploadConfirm: "ยืนยันอัปโหลด {count} ไฟล์",
    uploadDuplicate: "มีอยู่แล้วในงานนี้",
    uploadErrorTooLarge: "ไฟล์ใหญ่เกิน 40 MB",
    uploadErrorBadFormat: "รองรับเฉพาะ JPEG, PNG และ WebP",
    uploadErrorUnreadable: "เปิดไฟล์นี้ไม่ได้ อาจเสียหรือไม่ใช่รูป",
    uploadErrorServer: "อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง",
    photosTitle: "รูปในงานนี้",
    photosNone: "ยังไม่มีรูป",

    deleteEvent: "ลบงานนี้",
    deleteWarnTitle: "ลบแล้วกู้คืนไม่ได้ สิ่งที่จะหายไปคือ",
    deleteWarnPhotos: "รูปทั้งหมด {count} รูป ทั้งไฟล์ต้นฉบับและไฟล์ย่อ",
    deleteWarnFaces: "ข้อมูลใบหน้าที่ index ไว้ของงานนี้ทั้งชุด",
    deleteWarnCode: "รหัสงานและ QR จะใช้ไม่ได้อีก คนที่ถือรหัสอยู่จะเปิดไม่ได้",
    deleteWarnLive: "งานนี้เปิดให้ค้นหาอยู่ตอนนี้ — อาจมีคนได้รหัสไปแล้วและรอกลับมาโหลดรูป",
    deleteConfirmLabel: "พิมพ์ {code} เพื่อยืนยัน",
    deleteEventConfirm: "ลบงานนี้ถาวร",

    qrTitle: "QR code ของงาน",
    qrBody: "พิมพ์ติดที่บูธ หรือแชร์ลิงก์ในกลุ่มงาน",
    qrDownload: "โหลด QR",
    qrCopyLink: "คัดลอกลิงก์",
    qrCopied: "คัดลอกแล้ว",

    statsPhotos: "รูป",
    statsFaces: "ใบหน้าที่ index แล้ว",
    statsSearches: "การค้นหา",
    statsDownloads: "การโหลด",
  },

  admin: {
    title: "ผู้ดูแลระบบ",
    pendingEvents: "งานที่รออนุมัติ",
    pendingPhotographers: "ช่างภาพที่รออนุมัติ",
    nothingPending: "ไม่มีรายการรออนุมัติ",
    approve: "อนุมัติ",
    reject: "ไม่อนุมัติ",
    rejectReason: "เหตุผลที่ไม่อนุมัติ",
    rejectReasonHint: "ช่างภาพจะเห็นข้อความนี้",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติแล้ว",

    // --- ไดเรกทอรี ---
    reviewTitle: "รออนุมัติ",
    reviewCount: "{count} รายการรอคุณอยู่",
    reviewClear: "ไม่มีอะไรรออนุมัติ",
    directoryTitle: "ทุกคนในระบบ",
    directoryCount: "{count} บัญชี",
    directorySearch: "ค้นชื่อหรืออีเมล",
    directorySearchSubmit: "ค้นหา",
    directoryNoResults: "ไม่พบบัญชีที่ตรงกับที่ค้น",
    filterAll: "ทั้งหมด",
    filterUsers: "ผู้ใช้ทั่วไป",
    filterPhotographers: "ช่างภาพ",
    filterAdmins: "ผู้ดูแล",
    roleUser: "ผู้ใช้",
    rolePhotographer: "ช่างภาพ",
    roleAdmin: "ผู้ดูแล",
    roleWaiting: "รออนุมัติ",
    roleRevoked: "ถูกถอดสิทธิ์",
    you: "คุณ",
    joined: "เข้าร่วม {date}",
    eventsOwned: "{count} งาน",
    makePhotographer: "ตั้งเป็นช่างภาพ",
    makePhotographerHint:
      "ชื่อนี้จะขึ้นหน้างานสาธารณะว่า “ถ่ายโดย …” จึงต้องกรอกเอง ไม่ดึงจากบัญชี Google",
    displayNameLabel: "ชื่อที่แสดงบนหน้างาน",
    affiliationLabel: "สังกัด (ไม่บังคับ)",
    confirmPhotographer: "ยืนยันตั้งเป็นช่างภาพ",
    revokePhotographer: "ถอดสิทธิ์ช่างภาพ",
    revokeHint: "งานและรูปที่อัปโหลดไว้แล้วยังอยู่เหมือนเดิม แค่สร้างงานใหม่ไม่ได้",
    makeAdmin: "ตั้งเป็นผู้ดูแล",
    removeAdmin: "ถอดสิทธิ์ผู้ดูแล",
    viewEvents: "ดูงานทั้งหมด",
    pageOf: "หน้า {page} จาก {total}",
    prevPage: "ก่อนหน้า",
    nextPage: "ถัดไป",

    // --- ตัวเลขและกราฟ ---
    statUsers: "บัญชีทั้งหมด",
    statPhotographers: "ช่างภาพ",
    statEvents: "งานที่เปิดอยู่",
    statPhotos: "รูปในระบบ",
    statFaces: "ใบหน้าที่ index แล้ว",
    statSearches: "การค้นหาทั้งหมด",

    searchesTitle: "การค้นหาราย 30 วัน",
    searchesUnit: "ครั้ง",
    searchesEmpty: "ยังไม่มีการค้นหา",
    searchesEmptyBody:
      "กราฟจะเริ่มขึ้นเมื่อมีคนค้นหารูปตัวเองในงานจริงครั้งแรก ตอนนี้ยังไม่มีข้อมูลให้แสดง",
    searchesTable: "ดูเป็นตาราง",
    searchesColDay: "วันที่",
    searchesColCount: "ครั้ง",

    indexingTitle: "ความคืบหน้าการ index ใบหน้า",
    indexingRatio: "{done} จาก {total} รูป",
    indexingEmpty: "ยังไม่มีรูปในระบบ",
    indexingEmptyBody: "ตัวเลขจะขึ้นหลังช่างภาพอัปโหลดรูปงานแรก",
    indexIndexed: "สำเร็จ",
    indexWorking: "กำลังประมวลผล",
    indexNoFace: "ไม่พบใบหน้า",
    indexFailed: "ล้มเหลว",
  },

  auth: {
    signInTitle: "เข้าสู่ระบบ",
    signInLede: "เข้าด้วยบัญชี Google เพื่อบันทึกรูปหน้าและจัดการงานของคุณ",
    signInGoogle: "เข้าสู่ระบบด้วย Google",
    signInSkip: "ค้นหาโดยไม่เข้าสู่ระบบ",
    signInError: "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง",
  },

  status: {
    draft: "ร่าง",
    pending: "รออนุมัติ",
    approved: "เปิดให้ค้นหา",
    rejected: "ไม่อนุมัติ",
    archived: "เก็บถาวร",
  },

  common: {
    loading: "กำลังโหลด",
    cancel: "ยกเลิก",
    confirm: "ยืนยัน",
    save: "บันทึก",
    delete: "ลบ",
    back: "ก่อนหน้า",
    next: "ถัดไป",
    close: "ปิด",
    photos: "รูป",
    required: "จำเป็นต้องกรอก",
    notFoundTitle: "ไม่พบหน้านี้",
    notFoundBody: "ลิงก์อาจผิดหรือถูกลบไปแล้ว",
    errorTitle: "ระบบมีปัญหา",
    errorBody: "ลองรีเฟรชหน้านี้อีกครั้ง ถ้ายังไม่ได้แจ้งผู้ดูแล",
    retry: "ลองใหม่",
    goHome: "กลับหน้าแรก",
    forbiddenTitle: "เข้าหน้านี้ไม่ได้",
    forbiddenBody: "บัญชีของคุณไม่มีสิทธิ์เข้าหน้านี้",
    unauthorizedTitle: "ต้องเข้าสู่ระบบก่อน",
    unauthorizedBody: "หน้านี้ต้องเข้าสู่ระบบถึงจะเปิดได้",
  },

  footer: {
    pdpaLine:
      "ค้นแบบไม่สมัคร เซลฟี่ถูกลบทันทีที่ผลขึ้น · ค้นแบบมีบัญชี กดลบรูปหน้าได้ตลอดเวลา",
    pdpaLink: "อ่านนโยบายข้อมูลใบหน้า",
  },

  eventsPage: {
    title: "งานอีเวนต์",
    lede: "เลือกงานที่คุณไป แล้วค้นหารูปที่มีหน้าคุณ",
    count: "{count} งาน",
  },

  privacy: {
    title: "นโยบายข้อมูลใบหน้าและความเป็นส่วนตัว",
    lede: "ใบหน้าเป็นข้อมูลส่วนบุคคลอ่อนไหวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 หน้านี้อธิบายว่าระบบทำอะไรกับมันบ้าง ตามที่ระบบทำงานจริง",
    updated: "ปรับปรุงล่าสุด",
    sections: [
      {
        heading: "เราเก็บอะไรบ้าง",
        body: "ถ้าคุณค้นหาโดยไม่สมัครสมาชิก เราไม่เก็บอะไรที่ระบุตัวคุณได้เลย เซลฟี่ที่อัปโหลดถูกส่งไปเทียบใบหน้าแล้วลบทิ้งทันทีที่ผลลัพธ์กลับมา ถ้าคุณเข้าสู่ระบบด้วย Google เราเก็บชื่อ อีเมล และรูปโปรไฟล์จาก Google และเก็บรูปหน้าอ้างอิงหนึ่งใบเฉพาะเมื่อคุณกดบันทึกเอง นอกจากนี้เราเก็บบันทึกว่ามีการค้นหาในงานไหนเมื่อไหร่ พร้อมค่าแฮชของหมายเลขไอพี ไม่ใช่ตัวหมายเลขจริง",
      },
      {
        heading: "ฐานทางกฎหมาย",
        body: "การประมวลผลภาพใบหน้าใช้ฐานความยินยอมโดยชัดแจ้งตามมาตรา 26 คุณจะเห็นคำขอความยินยอมก่อนการค้นหาทุกครั้ง และถอนได้ตลอดเวลา การถอนความยินยอมไม่กระทบการประมวลผลที่ทำไปแล้วก่อนหน้า",
      },
      {
        heading: "ใบหน้าไม่ออกนอกงานที่ถ่าย",
        body: "ข้อมูลใบหน้าของแต่ละงานถูกเก็บแยกกันคนละชุดในระบบจดจำใบหน้า เมื่อคุณค้นหาในงานหนึ่ง ระบบเทียบกับชุดข้อมูลของงานนั้นเท่านั้น ไม่มีทางเทียบข้ามงานได้ เพราะข้อจำกัดนี้อยู่ที่โครงสร้างข้อมูล ไม่ใช่แค่เงื่อนไขในโปรแกรม",
      },
      {
        heading: "ส่งข้อมูลไปไหนบ้าง",
        body: "ภาพที่ใช้ตรวจจับใบหน้าถูกส่งไปยัง Amazon Rekognition ซึ่งเป็นบริการของ Amazon Web Services เพื่อประมวลผลเท่านั้น ไฟล์รูปต้นฉบับของงานเก็บอยู่บนเครื่องเซิร์ฟเวอร์ของเรา ไม่ได้ส่งขึ้นบริการภายนอก",
      },
      {
        heading: "เก็บไว้นานแค่ไหน",
        body: "เซลฟี่ของผู้ที่ไม่ได้สมัครสมาชิก ลบทันทีหลังค้นหาเสร็จ รูปหน้าอ้างอิงของผู้ที่มีบัญชี เก็บไว้จนกว่าคุณจะลบเองหรือลบบัญชี ข้อมูลใบหน้าที่สกัดจากรูปในงาน เก็บไว้ตราบที่งานนั้นยังเปิดให้ค้นหา และถูกลบพร้อมกันเมื่องานถูกลบ",
      },
      {
        heading: "สิทธิของคุณ",
        body: "คุณมีสิทธิขอเข้าถึง แก้ไข ลบ และถอนความยินยอมได้ตลอดเวลา ถ้ามีบัญชี ทำได้เองทันทีที่หน้าโปรไฟล์ ถ้าไม่มีบัญชี ไม่มีข้อมูลใดของคุณค้างอยู่ในระบบให้ต้องลบ นอกจากนี้คุณมีสิทธิร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล",
      },
      {
        heading: "รูปที่ช่างภาพถ่าย",
        body: "รูปในงานเป็นผลงานของช่างภาพ การลบข้อมูลใบหน้าของคุณจะทำให้ค้นหาตัวเองไม่เจอ แต่ไม่ได้ลบรูปออกจากอัลบั้มของงาน ถ้าต้องการให้นำรูปที่มีคุณออก ติดต่อผู้ดูแลระบบ",
      },
    ],
    contactHeading: "ติดต่อผู้ควบคุมข้อมูล",
    contactPlaceholder:
      "ยังไม่ได้ระบุช่องทางติดต่อ ต้องใส่ชื่อหน่วยงาน อีเมล และเบอร์โทรของผู้ควบคุมข้อมูลก่อนเปิดใช้งานจริง",
  },

  legal: {
    privacyTitle: "นโยบายความเป็นส่วนตัว",
    termsTitle: "เงื่อนไขการใช้งาน",
  },
};

// Deliberately not `as const`: widening the literals is what lets `en` hold
// different strings while still being checked against the same shape.
export type Dictionary = typeof th;

/** `en` is typed against `th`, so a missing key fails the build. */
export const en: Dictionary = {
  brand: {
    name: "Find KU Dae",
    tagline: "Find your photos from any event",
  },

  nav: {
    home: "Home",
    events: "Events",
    forPhotographers: "For photographers",
    studio: "Studio",
    admin: "Admin",
    profile: "Profile",
    signIn: "Sign in",
    signOut: "Sign out",
    switchLanguage: "ไทย",
    skipToContent: "Skip to content",
  },

  home: {
    headline: "Find your face in the whole event.",

    finderLabel: "Enter the 6-character event code",
    finderSubmit: "Open event",
    finderHint: "Letters and numbers — or paste an event link here instead.",
    finderSlotLabel: "Event code, character {n} of {total}",
    finderNotFound: "No event matches that. Check the link or code and try again.",
    finderEmpty: "Enter a link or code first.",
    finderUnavailable: "Something is temporarily down. Try again in a moment.",
    sub: "Scan the QR at the event, or open the link your photographer shared. We find you in the pile so you don't have to scroll it.",
    ctaPrimary: "Find my photos",
    ctaSecondary: "I'm a photographer",
    scanHint: "Or scan the QR at the event's photo booth",

    scrollCue: "Scroll to see how it works",
    skipToSearch: "Find your event",

    journeyTitle: "From your face to your photos",
    journeyLede: "Scroll through it one step at a time",
    journey: [
      {
        title: "Show us your face once",
        body: "Line your face up in the frame and shoot. No account needed, and the photo is used for this search only, then deleted.",
      },
      {
        title: "We read every face in the event",
        body: "Thousands of photos get looked at one by one, and every face found gets a box around it. It takes a few seconds.",
      },
      {
        title: "You get only the photos you're in",
        body: "The photos matching your face are pulled out. Download them at the full resolution the photographer uploaded.",
      },
    ],
    journeyScanning: "Reading faces",
    journeyFound: "Found you",

    finderHeading: "Find the event you were at",

    demoMatch: "That's you",
    demoCaption:
      "Illustration of how the search works. The boxes were placed by hand as an example, not produced by the system.",
    demoAlt:
      "A university event photo with a box drawn around each person's face, showing the system finding them",
    selfieAlt: "An illustration of a face being scanned, with a box drawn around it",

    stepsTitle: "How it works",
    stepsLede: "Three steps, about thirty seconds",
    steps: [
      {
        label: "Open",
        title: "Scan the QR or tap the link",
        body: "Photographers post a QR at the booth or drop the link in the event group. Open it and the whole gallery is there.",
      },
      {
        label: "Selfie",
        title: "Show us your face once",
        body: "Take or upload a front-facing photo. Signed in? We reuse the face you saved, so you never shoot it twice.",
      },
      {
        label: "Download",
        title: "Take every photo you're in",
        body: "Download all your matches at the full resolution the photographer uploaded.",
      },
    ],

    statEvents: "Events you can search",
    statPhotos: "Photos indexed",
    statFaces: "Faces you can search for",

    eventsTitle: "Events you can search now",
    eventsEmpty: "No events are open for search",
    eventsEmptyBody:
      "Events appear here once a photographer uploads photos and an admin approves them.",
    viewAllEvents: "See all events",

    privacyTitle: "Your face is sensitive data. Here's how we handle it.",
    privacyPoints: [
      {
        title: "Search without an account, nothing is kept",
        body: "The selfie you upload is deleted the moment your results load. No copy stays on our servers.",
      },
      {
        title: "Search with an account, one photo, delete it anytime",
        body: "We keep a single reference photo so you don't reshoot it at every event. Delete it from your profile whenever you want.",
      },
      {
        title: "We only match against the event you opened",
        body: "Each event's face data is a separate set. We never run your face across events you didn't open.",
      },
    ],
    privacyLink: "Read the full privacy policy",
  },

  event: {
    photosCount: "Photos",
    findMe: "Find my photos",
    browseAll: "Browse the whole event",
    by: "Shot by",
    notFound: "Event not found",
    notFoundBody:
      "The link may have expired, been mistyped, or the photographer hasn't opened it for search yet.",
    pendingTitle: "This event isn't open yet",
    pendingBody: "An admin is still reviewing it. Check back shortly.",
    accessCodeTitle: "This event needs a code",
    accessCodeBody: "Enter the code your photographer gave you to see the photos.",
    accessCodeLabel: "Access code",
    accessCodeSubmit: "View photos",
    accessCodeWrong: "That code doesn't match. Try again.",
    galleryEmpty: "No photos yet",
    galleryEmptyBody:
      "The photographer hasn't uploaded yet. Check back after the event wraps.",
    indexing: "Processing faces",
    indexingBody:
      "{count} more photos are still processing, so results may be incomplete.",
  },

  search: {
    title: "Find your photos",
    lede: "We'll match your face against this event only.",

    savedFaceTitle: "Use your saved face",
    savedFaceBody: "Search straight away, no new photo needed",
    savedFaceCta: "Search with my saved face",

    uploadTitle: "Take or upload a selfie",
    uploadBody: "Used for this search only, never stored",
    uploadCta: "Choose a photo",
    uploadRetake: "Choose another",
    uploadCamera: "Use camera",

    signInPrompt: "Tired of reshooting at every event?",
    signInPromptBody:
      "Sign in and save your face once, then use it across every event.",

    consentLabel:
      "I consent to my facial image being processed to find my photos in this event, and I understand facial data is sensitive personal data under Thailand's PDPA.",
    consentRequired: "Consent is required before searching.",
    consentReadPolicy: "Read what we collect",

    submit: "Search",
    scanning: "Matching your face",
    scanningBody: "This takes a few seconds",

    tipsTitle: "What works best",
    tips: [
      "Face the camera straight on",
      "Good light, not backlit",
      "Just you in the frame",
      "No sunglasses or mask",
    ],

    errorNoFace: "No face found in that photo. Try one where your face is clearer.",
    errorManyFaces: "That photo has several people. Use one with just you.",
    errorTooLarge: "That file is too large. Use a photo under 10 MB.",
    errorBadFormat: "Only JPEG, PNG and WebP files are supported.",
    errorGeneric: "The search failed. Try again.",
    errorRateLimited: "Too many searches. Wait a moment and try again.",
  },

  results: {
    title: "Found {count} photos of you",
    titleZero: "No photos of you yet",
    zeroBody:
      "The photographer may still be uploading, or the selfie wasn't clear enough. Try again with a straighter, sharper photo.",
    zeroRetry: "Try another photo",
    zeroBrowse: "Browse the event yourself",
    match: "{percent}% match",
    downloadOne: "Download",
    downloadAll: "Download all ({count})",
    downloading: "Preparing your files",
    searchAgain: "Search again",
    watermarkNote: "Photos from this event carry the photographer's watermark.",
  },

  profile: {
    title: "Profile",
    savedFaceTitle: "Saved face",
    savedFaceNone: "No face saved yet",
    savedFaceNoneBody:
      "Save one photo and reuse it at every event instead of uploading each time.",
    savedFaceAdd: "Save my face",
    savedFaceReplace: "Replace photo",
    savedFaceDelete: "Delete my face data",
    savedFaceDeleteConfirm:
      "Delete your saved face? You'll need to upload a selfie every time you search.",
    savedFaceDeleted: "Your saved face is deleted.",
    savedFaceStored: "Saved {date}",

    historyTitle: "Search history",
    historyEmpty: "No searches yet",

    consentTitle: "Consent",
    consentGranted: "Consent given {date}",
    consentWithdraw: "Withdraw consent",
    consentWithdrawBody:
      "Withdrawing deletes your saved face and disables face search until you consent again.",

    dangerTitle: "Delete account",
    dangerBody:
      "Permanently deletes your account, saved face, and search history. Photos taken by photographers stay up — those are their work.",
    dangerCta: "Delete my account",
  },

  photographer: {
    applyTitle: "Apply as a photographer",
    applyLede:
      "Fill this in and wait for admin approval. Once approved you can create events and upload photos.",
    displayName: "Display name",
    displayNameHint: "Shown under every photo you upload",
    affiliation: "Affiliation",
    affiliationHint: "The faculty, club, or team you shoot for",
    bio: "About you",
    contactEmail: "Contact email",
    contactPhone: "Contact phone",
    submit: "Send application",
    statusPending: "Waiting on admin review",
    statusPendingBody: "This usually takes a day or two.",
    statusRejected: "Application not approved",
    statusRejectedReason: "Reason",
  },

  studio: {
    title: "Studio",
    newEvent: "New event",
    eventsEmpty: "No events yet",
    eventsEmptyBody:
      "Create your first event, upload the photos, then send it for approval.",

    formNameTh: "Event name (Thai)",
    formNameEn: "Event name (English)",
    formSlug: "Event link",
    formSlugHint: "Used as the URL and as the QR code's destination",
    formDescription: "Description",
    formLocation: "Location",
    formEventDate: "Event date",
    formCover: "Cover image",
    formCoverClear: "Remove",
    formCoverHint:
      "JPEG, PNG or WebP, up to 10 MB. Optional — the first uploaded photo is used otherwise.",
    formErrorCoverTooLarge: "That cover is too large. Use a file under 10 MB.",
    formErrorCoverBadFormat: "The cover must be a JPEG, PNG or WebP.",
    formPrivate: "Private event",
    formPrivateHint:
      "Kept out of the public list, and a PIN is required before anyone can see the photos.",
    formPin: "6-digit entry PIN",
    formPinHint:
      "Digits only. Give it only to people who should get in. Stored hashed — it cannot be shown again, so set a new one if it is lost.",
    formPinSlot: "Entry PIN, digit {n} of {total}",
    formPinRandom: "Generate",
    formErrorPinRequired: "A private event needs a 6-digit entry PIN.",
    formAccessCode: "Event code",
    formAccessCodeHint: "Issued automatically. Print it under the QR at your booth.",
    formStatusDraft: "Still a draft — nobody can see it",
    formStatusPending: "Sent for review",
    formStatusApproved: "Live and searchable",
    formStatusRejected: "Not approved",
    formCreate: "Create event",
    formErrorInvalid: "Something is missing or not valid. Check the fields.",
    formErrorSlugTaken: "That link is taken. Try a different one.",
    formErrorUnavailable: "Something is temporarily down. Try again.",
    eventsCount: "{count} events",
    photosInEvent: "{count} photos",
    backToStudio: "Back to studio",
    openPublicPage: "Open the public page",
    qrPrint: "Print sheet",
    printScanTitle: "Find your photos from this event",
    printScanBody: "Scan the QR, or go to {url} and enter the code",
    printButton: "Print",
    formSave: "Save",
    formSubmitForReview: "Send for approval",

    watermarkTitle: "Watermark",
    watermarkLede:
      "Set per event. The watermark is burned in when someone downloads.",
    watermarkEnabled: "Watermark downloaded photos",
    watermarkText: "Watermark text",
    watermarkLogo: "Watermark logo (transparent PNG)",
    watermarkPosition: "Position",
    watermarkOpacity: "Opacity",
    watermarkScale: "Size",
    watermarkPreview: "Preview",
    watermarkPositions: {
      bottom_right: "Bottom right",
      bottom_left: "Bottom left",
      top_right: "Top right",
      top_left: "Top left",
      center: "Center",
      tiled: "Tiled",
    },

    uploadTitle: "Upload photos",
    uploadDrop: "Drop files here, or choose them",
    uploadHint: "JPEG, PNG or WebP. Upload as many at once as you like.",
    uploadQueue: "Upload queue",
    uploadDone: "Uploaded {done} of {total}",
    uploadCta: "Choose files",
    uploadRetry: "Retry the failed ones",
    uploadComplete: "All uploaded",
    uploadStaged: "{count} files chosen",
    uploadSelectAll: "Select all",
    uploadRemoveSelected: "Remove {count}",
    uploadRemoveOne: "Remove",
    uploadConfirm: "Upload {count} files",
    uploadDuplicate: "Already in this event",
    uploadErrorTooLarge: "Larger than 40 MB",
    uploadErrorBadFormat: "Only JPEG, PNG and WebP",
    uploadErrorUnreadable: "Could not read this file — corrupt, or not an image",
    uploadErrorServer: "Upload failed. Try again.",
    photosTitle: "Photos in this event",
    photosNone: "No photos yet",

    deleteEvent: "Delete this event",
    deleteWarnTitle: "This cannot be undone. It removes:",
    deleteWarnPhotos: "All {count} photos — originals and derivatives",
    deleteWarnFaces: "Every indexed face for this event",
    deleteWarnCode: "The event code and QR stop working for anyone holding them",
    deleteWarnLive: "This event is live — people may already have the code and be waiting to collect their photos",
    deleteConfirmLabel: "Type {code} to confirm",
    deleteEventConfirm: "Delete permanently",

    qrTitle: "Event QR code",
    qrBody: "Print it for the booth, or share the link in the event group.",
    qrDownload: "Download QR",
    qrCopyLink: "Copy link",
    qrCopied: "Copied",

    statsPhotos: "Photos",
    statsFaces: "Faces indexed",
    statsSearches: "Searches",
    statsDownloads: "Downloads",
  },

  admin: {
    title: "Admin",
    pendingEvents: "Events awaiting approval",
    pendingPhotographers: "Photographers awaiting approval",
    nothingPending: "Nothing is waiting for review",
    approve: "Approve",
    reject: "Reject",
    rejectReason: "Reason for rejection",
    rejectReasonHint: "The photographer will see this",
    approved: "Approved",
    rejected: "Rejected",

    reviewTitle: "Waiting for review",
    reviewCount: "{count} waiting on you",
    reviewClear: "Nothing is waiting for review",
    directoryTitle: "Everyone",
    directoryCount: "{count} accounts",
    directorySearch: "Search name or email",
    directorySearchSubmit: "Search",
    directoryNoResults: "No account matches that search",
    filterAll: "All",
    filterUsers: "Regular users",
    filterPhotographers: "Photographers",
    filterAdmins: "Admins",
    roleUser: "User",
    rolePhotographer: "Photographer",
    roleAdmin: "Admin",
    roleWaiting: "Awaiting review",
    roleRevoked: "Revoked",
    you: "You",
    joined: "Joined {date}",
    eventsOwned: "{count} events",
    makePhotographer: "Make photographer",
    makePhotographerHint:
      "This name appears on public event pages as “Photographed by …”, so it is typed rather than taken from the Google account.",
    displayNameLabel: "Name shown on events",
    affiliationLabel: "Affiliation (optional)",
    confirmPhotographer: "Confirm",
    revokePhotographer: "Revoke photographer",
    revokeHint: "Existing events and photos stay exactly as they are; only new events are blocked.",
    makeAdmin: "Make admin",
    removeAdmin: "Remove admin",
    viewEvents: "View all events",
    pageOf: "Page {page} of {total}",
    prevPage: "Previous",
    nextPage: "Next",

    statUsers: "Accounts",
    statPhotographers: "Photographers",
    statEvents: "Live events",
    statPhotos: "Photos",
    statFaces: "Faces indexed",
    statSearches: "Searches",

    searchesTitle: "Searches, last 30 days",
    searchesUnit: "total",
    searchesEmpty: "No searches yet",
    searchesEmptyBody:
      "This starts plotting the first time somebody searches a real event. There is nothing to show until then.",
    searchesTable: "Show as a table",
    searchesColDay: "Day",
    searchesColCount: "Searches",

    indexingTitle: "Face indexing progress",
    indexingRatio: "{done} of {total} photos",
    indexingEmpty: "No photos yet",
    indexingEmptyBody: "These fill in once a photographer uploads their first event.",
    indexIndexed: "Indexed",
    indexWorking: "In progress",
    indexNoFace: "No face found",
    indexFailed: "Failed",
  },

  auth: {
    signInTitle: "Sign in",
    signInLede:
      "Sign in with Google to save your face and manage your events.",
    signInGoogle: "Continue with Google",
    signInSkip: "Search without signing in",
    signInError: "Sign in failed. Try again.",
  },

  status: {
    draft: "Draft",
    pending: "Awaiting approval",
    approved: "Open for search",
    rejected: "Rejected",
    archived: "Archived",
  },

  common: {
    loading: "Loading",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    delete: "Delete",
    back: "Previous",
    next: "Next",
    close: "Close",
    photos: "photos",
    required: "Required",
    notFoundTitle: "Page not found",
    notFoundBody: "The link may be wrong or the page was removed.",
    errorTitle: "Something broke",
    errorBody: "Refresh the page. If it keeps happening, tell an admin.",
    retry: "Try again",
    goHome: "Back to home",
    forbiddenTitle: "You can't open this page",
    forbiddenBody: "Your account doesn't have access to it.",
    unauthorizedTitle: "Sign in to continue",
    unauthorizedBody: "This page is only available once you're signed in.",
  },

  footer: {
    pdpaLine:
      "Search without an account and your selfie is deleted the moment results load · Signed in, delete your saved face anytime",
    pdpaLink: "Read the face data policy",
  },

  eventsPage: {
    title: "Events",
    lede: "Pick the event you went to, then find the photos you're in.",
    count: "{count} events",
  },

  privacy: {
    title: "Face data and privacy",
    lede: "A facial image is sensitive personal data under Thailand's Personal Data Protection Act B.E. 2562. This page describes what the system actually does with it.",
    updated: "Last updated",
    sections: [
      {
        heading: "What we collect",
        body: "If you search without an account we keep nothing that identifies you. Your selfie is sent for matching and deleted the moment the results come back. If you sign in with Google we store the name, email and profile photo Google gives us, and we store a single reference photo of your face only if you choose to save one. We also log which event was searched and when, along with a hash of the IP address rather than the address itself.",
      },
      {
        heading: "Legal basis",
        body: "Processing a facial image relies on your explicit consent under section 26. You are asked for it before every search and can withdraw it at any time. Withdrawal does not undo processing that already happened.",
      },
      {
        heading: "Faces never leave the event they were shot at",
        body: "Each event's face data lives in its own separate collection. When you search one event, we compare against that event's set and nothing else. Cross-event matching is not merely disallowed — it is impossible, because the limit is in how the data is stored rather than in a rule the software could skip.",
      },
      {
        heading: "Who else sees it",
        body: "Images used for face detection are sent to Amazon Rekognition, an Amazon Web Services product, for processing only. The original event photographs stay on our own server and are not uploaded to any external service.",
      },
      {
        heading: "How long we keep it",
        body: "Selfies from visitors without an account are deleted as soon as the search finishes. A saved reference photo stays until you delete it or delete your account. Face data extracted from event photographs lasts as long as that event is open for search, and is removed with the event.",
      },
      {
        heading: "Your rights",
        body: "You may access, correct, delete, and withdraw consent at any time. With an account you can do all of it yourself from your profile. Without an account there is nothing of yours left in the system to delete. You may also complain to Thailand's Personal Data Protection Committee.",
      },
      {
        heading: "The photographer's photos",
        body: "Event photographs are the photographer's work. Deleting your face data stops you being findable, but does not remove any photograph from the event album. To have a photograph you appear in taken down, contact an administrator.",
      },
    ],
    contactHeading: "Data controller contact",
    contactPlaceholder:
      "No contact route has been set. The controlling department's name, email and phone number must be filled in here before this goes live.",
  },

  legal: {
    privacyTitle: "Privacy policy",
    termsTitle: "Terms of use",
  },
};

export const dictionaries = { th, en };

/**
 * Fills `{name}` placeholders.
 *
 * Lives here rather than in `lib/i18n/index.ts` because that module reads
 * cookies through `next/headers`, and importing it from a Client Component
 * drags a server-only API into the browser bundle. This function is pure, so
 * both sides can use it.
 *
 * Deliberately dumb — no plural rules. Thai has no plural forms, and every
 * English string here is written to read correctly with any count.
 */
export function t(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
