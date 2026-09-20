import type { Metadata } from 'next'
import Script from 'next/script'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Hotel Sree Vaishnaves - Quality Vegetarian Restaurant, Kannur',
  description:
    '21 years of serving quality vegetarian food in Kannur, Kerala. South Indian, North Indian and Chinese cuisines.',
}

export default function HotelWebsite() {
  return (
    <>
      {/* -- Vendor CSS ------------------------------------------- */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600;1,700&family=Amatic+SC:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap"
        rel="stylesheet"
      />
      <link href="/assets/vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet" />
      <link href="/assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet" />
      <link href="/assets/vendor/aos/aos.css" rel="stylesheet" />
      <link href="/assets/vendor/glightbox/css/glightbox.min.css" rel="stylesheet" />
      <link href="/assets/vendor/swiper/swiper-bundle.min.css" rel="stylesheet" />
      <link href="/main.css" rel="stylesheet" />

      

  {/*  ======= Header =======  */}
  <header id="header" className="header fixed-top d-flex align-items-center">
    <div className="container d-flex align-items-center justify-content-between">

      <a href="/" className="logo d-flex align-items-center me-auto me-lg-0">
        <img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Flogo%2FLogo.webp?alt=media&token=dcd8e5cb-6183-4e37-bc4c-b69fa92c9855" alt="" />
      </a>

      <nav id="navbar" className="navbar">
        <ul>
          <li><a href="#home" className="active">Home</a></li>
          <li><a href="#about">About Us</a></li>
          <li><a href="#menu">Menu</a></li>
          <li><a href="#gallery">Gallery</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>{/*  .navbar  */}

      <a className="btn-book-a-table" href="https://www.google.com/search?q=Hotel+Sree+Vaishnaves&rlz=1C1EJFC_enIN856IN856&oq=hotel&aqs=chrome.0.69i59j69i57j69i59j35i39j0i131i433i512j69i65l2j69i60.1551j0j7&sourceid=chrome&ie=UTF-8" target="_blank">Google</a>
      <i className="mobile-nav-toggle mobile-nav-show bi bi-list"></i>
      <i className="mobile-nav-toggle mobile-nav-hide d-none bi bi-x"></i>

    </div>
  </header>{/*  End Header  */}

  {/*  ======= Hero Section =======  */}
  <section id="home" className="hero d-flex align-items-center section-bg">
    <div className="container">
      <div className="row justify-content-between gy-5">
        <div className="col-lg-5 order-2 order-lg-1 d-flex flex-column justify-content-center align-items-center align-items-lg-start text-center text-lg-start">
          <h2 data-aos="fade-up">Hotel<br />Sree Vaishnaves</h2>
          <p data-aos="fade-up" data-aos-delay="100">High class Vegetarian restaurant providing south Indian, north Indian and chinese cuisines at an affordable price.</p>
          <div className="d-flex" data-aos="fade-up" data-aos-delay="200">
            <a href="#menu" className="btn-book-a-table">Check Menu</a>
            <a href="https://www.youtube.com/watch?v=3kOrYYF6VKg" className="glightbox btn-watch-video d-flex align-items-center"><i className="bi bi-play-circle"></i><span>Watch Video</span></a>
          </div>
        </div>
        <div className="col-lg-5 order-1 order-lg-2 text-center text-lg-start">
          <img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Flogo%2Fhero-img.webp?alt=media&token=66baa7eb-8f3c-48b9-8c1f-c1443889e719" className="img-fluid" alt="" data-aos="zoom-out" data-aos-delay="300" style={{"borderRadius":"250px"}} />
        </div>
      </div>
    </div>
  </section>{/*  End Hero Section  */}

  <main id="main">

    {/*  ======= About Section =======  */}
    <section id="about" className="about">
      <div className="container" data-aos="fade-up">

        <div className="section-header">
          <h2>About Us</h2>
          <p>Learn More <span>About Us</span></p>
        </div>

        <div className="row gy-4">
          <div className="col-lg-7 position-relative about-img" style={{"backgroundImage":"url(https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2FSouth%20Indian.webp?alt=media&token=92f31e2a-0412-4dc5-b025-f84e100bdf2f)","backgroundSize":"contain","backgroundRepeat":"no-repeat"}}  data-aos="fade-up" data-aos-delay="150">
          </div>
          <div className="col-lg-5 d-flex align-items-end" data-aos="fade-up" data-aos-delay="300">
            <div className="content ps-0 ps-lg-5">
              <p className="fst-italic">
                Located at the heart of Kannur city. In our restaurant , we provide -
              </p>
              <ul>
                <li><i className="bi bi-check2-all"></i> High Quality South Indian style Tiffin and Dinner.</li>
                <li><i className="bi bi-check2-all"></i> Delicious Tamilnadu style Meals in afternoon.</li>
                <li><i className="bi bi-check2-all"></i> North Indian and Chinese cuisines available for dinner.</li>
              </ul>
              <p>
                We also have hot beverages such as Tea, Coffee etc.. with a combo of crispy vada, bonda and other snack items 
                which are available. Which can be enjoyed as a evening snack with your friends and family.
              </p>

              <div className="position-relative mt-4">
                <img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FLunch%2Ftamilnadu-meals.jpg?alt=media&token=1c614711-578c-4c70-9757-6238a485a90b" className="img-fluid" alt="" style={{"height":"80%","backgroundSize":"contain","backgroundRepeat":"no-repeat"}} />
                <a href="https://www.youtube.com/watch?v=HpDTz2-j62I" className="glightbox play-btn"></a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>{/*  End About Section  */}

    {/*  ======= Why Us Section =======  */}
    <section id="why-us" className="why-us section-bg">
      <div className="container" data-aos="fade-up">

        <div className="row gy-4">

          <div className="col-lg-4" data-aos="fade-up" data-aos-delay="100">
            <div className="why-box">
              <h3>Why Sree Vaishnaves?</h3>
              <p>
                We have 21 years of expertise in providing quality vegetarian food to lovely people of Kannur. Constantly introducing 
                new food varieties for our people while maintaining the food standards. All the materials for preparing the food are custom 
                picked to give the Delicious result while blending together. We are proud that we have a rating of (4.1/5) from 1000+ customers.
              </p>
              <div className="text-center">
                <a href="https://www.google.com/maps/place/Hotel+Sree+Vaishnaves/@11.8709781,75.3640015,15z/data=!4m6!3m5!1s0x3ba43d4b99705855:0xa9d33b2a2512eb4d!8m2!3d11.8709781!4d75.3640015!16s%2Fg%2F11h0040hc_?sa=X&ved=2ahUKEwixvtGr8I_9AhWrTWwGHTy5BBkQ_BJ6BAg9EAg&coh=164777&entry=tt" className="more-btn" target="_blank">Learn More <i className="bx bx-chevron-right" ></i></a>
              </div>
            </div>
          </div>{/*  End Why Box  */}

          <div className="col-lg-8 d-flex align-items-center">
            <div className="row gy-4">

              <div className="col-xl-4" data-aos="fade-up" data-aos-delay="200">
                <div className="icon-box d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-clipboard-data"></i>
                  <h4>Hygenic Facility</h4>
                  <p>Our restaurant meets all the requirements of the safety standards. All the foods are freshly prepared and served hot.
                      Our work force regularly makes sure of the safety and health standards for the wellbeing of our customers.
                  </p>
                </div>
              </div>{/*  End Icon Box  */}

              <div className="col-xl-4" data-aos="fade-up" data-aos-delay="300">
                <div className="icon-box d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-gem"></i>
                  <h4>Spacious parking</h4>
                  <p>In the heart of Kannur city, we provide a secure parking facility for both cars and 2-wheelers for our customers, so the food can be enjoyed with your friends and 
                    family hazzle free. 
                  </p>
                </div>
              </div>{/*  End Icon Box  */}

              <div className="col-xl-4" data-aos="fade-up" data-aos-delay="400">
                <div className="icon-box d-flex flex-column justify-content-center align-items-center">
                  <i className="bi bi-inboxes"></i>
                  <h4>Shoping made easy</h4>
                  <p>We have budget friendly products for your day to day home needs. The products such as - bed spreads, travel bags, towels,
                    hand bags, bed sheets, pillow covers, quilts etc.. of high quality materials.
                  </p>
                </div>
              </div>{/*  End Icon Box  */}

            </div>
          </div>

        </div>

      </div>
    </section>{/*  End Why Us Section  */}

    {/*  ======= Stats Counter Section =======  */}
    <section id="stats-counter" className="stats-counter">
      <div className="container" data-aos="zoom-out">

        <div className="row gy-4">

          <div className="col-lg-3 col-md-6">
            <div className="stats-item text-center w-100 h-100">
              <span data-purecounter-start="0" data-purecounter-end="92" data-purecounter-duration="1" className="purecounter"></span>
              <p>Seating Capacity</p>
            </div>
          </div>{/*  End Stats Item  */}

          <div className="col-lg-3 col-md-6">
            <div className="stats-item text-center w-100 h-100">
              <span data-purecounter-start="0" data-purecounter-end="21" data-purecounter-duration="1" className="purecounter"></span>
              <p>Years of service</p>
            </div>
          </div>{/*  End Stats Item  */}

          <div className="col-lg-3 col-md-6">
            <div className="stats-item text-center w-100 h-100">
              <span data-purecounter-start="0" data-purecounter-end="72" data-purecounter-duration="1" className="purecounter"></span>
              <p>Dishes Available</p>
            </div>
          </div>{/*  End Stats Item  */}

          <div className="col-lg-3 col-md-6">
            <div className="stats-item text-center w-100 h-100">
              <span data-purecounter-start="0" data-purecounter-end="1" data-purecounter-duration="1" className="purecounter"></span>
              <p>Branch</p>
            </div>
          </div>{/*  End Stats Item  */}

        </div>

      </div>
    </section>{/*  End Stats Counter Section  */}

    {/*  ======= Menu Section =======  */}
    <section id="menu" className="menu">
      <div className="container" data-aos="fade-up">

        <div className="section-header">
          <h2>Our Menu</h2>
          <p>Check Our <span>Vegetarian Menu</span></p>
        </div>

        <ul className="nav nav-tabs d-flex justify-content-center" data-aos="fade-up" data-aos-delay="200">

          <li className="nav-item">
            <a className="nav-link active show" data-bs-toggle="tab" data-bs-target="#menu-starters">
              <h4>South Indian</h4>
            </a>
          </li>{/*  End tab nav item  */}

          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" data-bs-target="#menu-breakfast">
              <h4>Lunch</h4>
            </a>
          </li>{/*  End tab nav item  */}

          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" data-bs-target="#menu-lunch">
              <h4>North Indian & Chinese</h4>
            </a>
          </li>{/*  End tab nav item  */}

          <li className="nav-item">
            <a className="nav-link" data-bs-toggle="tab" data-bs-target="#menu-dinner">
              <h4>Snacks and Beverages</h4>
            </a>
          </li>{/*  End tab nav item  */}

        </ul>

        <div className="tab-content" data-aos="fade-up" data-aos-delay="300">

          <div className="tab-pane fade active show" id="menu-starters">

            <div className="tab-header text-center">
              <p>Menu</p>
              <h3>South Indian</h3>
            </div>

            <div className="row gy-5">

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fidly.webp?alt=media&token=447cf224-2413-4e58-b460-2e02ceec9665" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fidly.webp?alt=media&token=447cf224-2413-4e58-b460-2e02ceec9665" className="menu-img img-fluid" alt="" /></a>
                <h4>Idly</h4>
                <p className="ingredients">
                  Idly plate, Mini Sambar Idly
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fpongal.webp?alt=media&token=70b50f8d-8a05-4a39-9337-fe984db1720d" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fpongal.webp?alt=media&token=70b50f8d-8a05-4a39-9337-fe984db1720d" className="menu-img img-fluid" style={{"paddingTop":"26%"}} alt="" /></a>
                <h4>Pongal</h4>
                <p className="ingredients">
                  Available for breakfast
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fpoori.webp?alt=media&token=0032a900-b2b8-47f1-9c5d-8fd1a9c07e28" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fpoori.webp?alt=media&token=0032a900-b2b8-47f1-9c5d-8fd1a9c07e28" className="menu-img img-fluid" style={{"paddingTop":"26%"}} alt="" /></a>
                <h4>Poori</h4>
                <p className="ingredients">
                  Poori Baaji, Chenna Bhatura
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2FDosa.webp?alt=media&token=05c69396-c3c2-45e5-81ac-4d1ebe5be2d0" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2FDosa.webp?alt=media&token=05c69396-c3c2-45e5-81ac-4d1ebe5be2d0" className="menu-img img-fluid" alt="" /></a>
                <h4>Roast</h4>
                <p className="ingredients">
                  Plain Roast, Special(Ghee) Roast, Masala Roast, Onion Roast
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Frava-dosa.webp?alt=media&token=577ef319-34cf-430c-a3b3-10b479af682c" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Frava-dosa.webp?alt=media&token=577ef319-34cf-430c-a3b3-10b479af682c" className="menu-img img-fluid" alt="" /></a>
                <h4>Rava Roast</h4>
                <p className="ingredients">
                  Plain Rava, Onion Rava, Rava Masala
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Futhapam.webp?alt=media&token=9c29b26c-7cb7-48f6-b248-acfad5b64702" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Futhapam.webp?alt=media&token=9c29b26c-7cb7-48f6-b248-acfad5b64702" className="menu-img img-fluid" style={{"paddingTop":"20%"}} alt="" /></a>
                <h4>Uthapam</h4>
                <p className="ingredients">
                  Plain Uthapam, Onion Uthapam, Ghee Onion Uthapam
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fspecial-dosa.webp?alt=media&token=276f9362-dac0-4952-8a5b-9c477c9a4964" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fspecial-dosa.webp?alt=media&token=276f9362-dac0-4952-8a5b-9c477c9a4964" className="menu-img img-fluid" style={{"paddingTop":"5%"}} alt="" /></a>
                <h4>Special Masala Roast</h4>
                <p className="ingredients">
                  Paneer Masala, Mushroom Masala, Gobi Masala
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fpodi-dosa.webp?alt=media&token=05e11f4f-2b0d-4238-9dd1-f69eade3444d" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fpodi-dosa.webp?alt=media&token=05e11f4f-2b0d-4238-9dd1-f69eade3444d" className="menu-img img-fluid" style={{"paddingTop":"5%"}} alt="" /></a>
                <h4>Podi Roast</h4>
                <p className="ingredients">
                  Yellu Podi, Garlic Podi, Curry Leaf Podi
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fchappathi.webp?alt=media&token=e0c0571f-de02-4cd6-a932-3b4f81c8228a" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSouth%20Indian%2Fchappathi.webp?alt=media&token=e0c0571f-de02-4cd6-a932-3b4f81c8228a" className="menu-img img-fluid" alt="" /></a>
                <h4>Chappathi & Parotta</h4>
                <p className="ingredients">
                  Vegetable gravy included in the set
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

            </div>
          </div>{/*  End Starter Menu Content  */}

          <div className="tab-pane fade" id="menu-breakfast">

            <div className="tab-header text-center">
              <p>Menu</p>
              <h3>Lunch</h3>
            </div>

            <div className="row gy-5">

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FLunch%2Ftamilnadu-meals-bg.png?alt=media&token=7480f6c4-acd2-4659-a6f5-bed4829b519b" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FLunch%2Ftamilnadu-meals-bg.png?alt=media&token=7480f6c4-acd2-4659-a6f5-bed4829b519b" className="menu-img img-fluid" alt="" /></a>
                <h4>Meals with Ponni Rice</h4>
                <p className="ingredients">
                  Curd available seperately
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}
              
              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FLunch%2Ftamilnadu-meals-bg.png?alt=media&token=7480f6c4-acd2-4659-a6f5-bed4829b519b" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FLunch%2Ftamilnadu-meals-bg.png?alt=media&token=7480f6c4-acd2-4659-a6f5-bed4829b519b" className="menu-img img-fluid" alt="" /></a>
                <h4>Meals with Kuruva Rice</h4>
                <p className="ingredients">
                  Curd available seperately
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

            </div>
          </div>{/*  End Breakfast Menu Content  */}

          <div className="tab-pane fade" id="menu-lunch">

            <div className="tab-header text-center">
              <p>Menu</p>
              <h3>North Indian & Chinese</h3>
            </div>

            <div className="row gy-5">

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fnoodles.webp?alt=media&token=50102d7c-338d-4fd0-8817-5588c5d85d04" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fnoodles.webp?alt=media&token=50102d7c-338d-4fd0-8817-5588c5d85d04" className="menu-img img-fluid" alt="" /></a>
                <h4>Noodles</h4>
                <p className="ingredients">
                  Veg , Paneer, Gobi, Mushroom
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fshezwan-noodles.webp?alt=media&token=fdfa1bc0-442e-42c1-b614-bb6b7dbd73a8" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fshezwan-noodles.webp?alt=media&token=fdfa1bc0-442e-42c1-b614-bb6b7dbd73a8" className="menu-img img-fluid" style={{"paddingTop":"5%"}} alt="" /></a>
                <h4>Schezwan Noodles</h4>
                <p className="ingredients">
                  Made with spicy Schezwan sauce
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Ffried-rice.webp?alt=media&token=f618d249-e6f5-4c85-a316-ced31b0ea862" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Ffried-rice.webp?alt=media&token=f618d249-e6f5-4c85-a316-ced31b0ea862" className="menu-img img-fluid" style={{"paddingTop":"15%"}} alt="" /></a>
                <h4>Fried Rice</h4>
                <p className="ingredients">
                  Veg , Paneer, Gobi, Mushroom
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fshezwan-rice.webp?alt=media&token=99b17187-ecd8-4042-a118-9fdfdaee0173" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fshezwan-rice.webp?alt=media&token=99b17187-ecd8-4042-a118-9fdfdaee0173" className="menu-img img-fluid" style={{"paddingTop":"26%"}}alt="" /></a>
                <h4>Schezwan Fried Rice</h4>
                <p className="ingredients">
                  Made with spicy Schezwan sauce
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fchilli.webp?alt=media&token=bf605a29-fbcd-4d78-b478-736a5c55a8ce" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fchilli.webp?alt=media&token=bf605a29-fbcd-4d78-b478-736a5c55a8ce" className="menu-img img-fluid" style={{"paddingTop":"5%"}} alt="" /></a>
                <h4>Chilly</h4>
                <p className="ingredients">
                  Paneer, Mushroom, Gobi
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fpaneer-butter.webp?alt=media&token=a2f75603-76a9-4ad6-bc7d-7a0d913ce5f0" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fpaneer-butter.webp?alt=media&token=a2f75603-76a9-4ad6-bc7d-7a0d913ce5f0" className="menu-img img-fluid" style={{"paddingTop":"5%"}} alt="" /></a>
                <h4>Paneer Butter Masala</h4>
                <p className="ingredients">
                  Delicious gravy is a perfect combination for chappathi.
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fgobi-manchurian.webp?alt=media&token=5c44600d-fbb3-4821-ba27-cb2ba42c3669" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fgobi-manchurian.webp?alt=media&token=5c44600d-fbb3-4821-ba27-cb2ba42c3669" className="menu-img img-fluid" alt="" /></a>
                <h4>Gobi Manchurian</h4>
                <p className="ingredients">
                  Dry, Semi-Dry, Gravy
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fpaneer-manchurian.webp?alt=media&token=bcd5a7eb-f979-4989-959a-8444a1db6397" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fpaneer-manchurian.webp?alt=media&token=bcd5a7eb-f979-4989-959a-8444a1db6397 " className="menu-img img-fluid" style={{"paddingTop":"30%"}} alt="" /></a>
                <h4>Paneer Manchurian</h4>
                <p className="ingredients">
                  Dry, Semi-Dry, Gravy
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fmushroom-manchurian.webp?alt=media&token=f47ac32a-e90f-4413-8b1f-433cd4651bc9" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fmushroom-manchurian.webp?alt=media&token=f47ac32a-e90f-4413-8b1f-433cd4651bc9" className="menu-img img-fluid" style={{"paddingTop":"5%"}} alt="" /></a>
                <h4>Mushroom Manchurian</h4>
                <p className="ingredients">
                  Dry, Semi-Dry, Gravy
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fpaneer-65.webp?alt=media&token=7a5a61fd-efbd-4b4b-80dd-4e117968da9e" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fpaneer-65.webp?alt=media&token=7a5a61fd-efbd-4b4b-80dd-4e117968da9e" className="menu-img img-fluid" style={{"paddingTop":"25%"}} alt="" /></a>
                <h4>65 Dry</h4>
                <p className="ingredients">
                  Paneer, Mushroom, Gobi
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fkothu-parotta.webp?alt=media&token=f6a0d94e-7ef2-424a-8487-17a8f5caca62" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FNorth%20Indian%20%26%20Chinese%2Fkothu-parotta.webp?alt=media&token=f6a0d94e-7ef2-424a-8487-17a8f5caca62" className="menu-img img-fluid" style={{"paddingTop":"20%"}} alt="" /></a>
                <h4>Chilli Parotta</h4>
                <p className="ingredients">
                  Cooked with tempered spices & onions
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

            </div>
          </div>{/*  End Lunch Menu Content  */}

          <div className="tab-pane fade" id="menu-dinner">

            <div className="tab-header text-center">
              <p>Menu</p>
              <h3>Snacks and Beverages</h3>
            </div>

            <div className="row gy-5">

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Ftea.webp?alt=media&token=57815972-416d-4429-ac09-34b90f1eaf25" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Ftea.webp?alt=media&token=57815972-416d-4429-ac09-34b90f1eaf25" className="menu-img img-fluid" style={{"paddingTop":"10%"}} alt="" /></a>
                <h4>Tea</h4>
                <p className="ingredients">
                  Masala Tea, Black Tea
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fcoffee.webp?alt=media&token=ce139c59-fae4-4940-b0e1-a8369253e99e" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fcoffee.webp?alt=media&token=ce139c59-fae4-4940-b0e1-a8369253e99e" className="menu-img img-fluid" style={{"paddingTop":"15%"}} alt="" /></a>
                <h4>Coffee</h4>
                <p className="ingredients">
                  Bru Coffee, Black Coffee
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fmilk.webp?alt=media&token=5b0f5c20-d5cc-450a-83a4-9c659fe1c7e3" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fmilk.webp?alt=media&token=5b0f5c20-d5cc-450a-83a4-9c659fe1c7e3" className="menu-img img-fluid" alt="" /></a>
                <h4>Milk</h4>
                <p className="ingredients">
                  Milk, Horlicks, Boost, Hot Badam Milk
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Frose-milk.webp?alt=media&token=f6a6aabc-b628-47ef-beb2-bce966a37dbd" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Frose-milk.webp?alt=media&token=f6a6aabc-b628-47ef-beb2-bce966a37dbd" className="menu-img img-fluid" alt="" /></a>
                <h4>Cold Milk</h4>
                <p className="ingredients">
                  Rose Milk, Badam Milk
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}
              
              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fkesari.webp?alt=media&token=b18904c1-fa4a-4223-a0d1-19e5b3bdd055" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fkesari.webp?alt=media&token=b18904c1-fa4a-4223-a0d1-19e5b3bdd055" className="menu-img img-fluid" style={{"paddingTop":"22%"}} alt="" /></a>
                <h4>Kesari</h4>
                <p className="ingredients">
                  This sweet is available throughout the day
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fvada.webp?alt=media&token=cd8372aa-9b2d-4a33-b6f8-9135793f0758" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fvada.webp?alt=media&token=cd8372aa-9b2d-4a33-b6f8-9135793f0758" className="menu-img img-fluid" style={{"paddingTop":"22%"}} alt="" /></a>
                <h4>Vada</h4>
                <p className="ingredients">
                  Medhu Vada, Parupu Vada
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fsambar-vada.webp?alt=media&token=1b6d8e71-4f20-46dd-af3d-dfb2f2cd961e" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fsambar-vada.webp?alt=media&token=1b6d8e71-4f20-46dd-af3d-dfb2f2cd961e" className="menu-img img-fluid" style={{"paddingTop":"25%"}} alt="" /></a>
                <h4>Sambar Vada</h4>
                <p className="ingredients">
                  Medhu Vada dipped in sambar
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fcutlet.webp?alt=media&token=1e983dfd-2358-4da0-982d-3e8d9dc8a250" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fcutlet.webp?alt=media&token=1e983dfd-2358-4da0-982d-3e8d9dc8a250" className="menu-img img-fluid" style={{"paddingTop":"15%"}} alt="" /></a>
                <h4>Cutlet</h4>
                <p className="ingredients">
                  Grap the evening snack with tomato sauce
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fbajji.webp?alt=media&token=4f256f73-8fee-40b9-a76d-420615d263d6" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fbajji.webp?alt=media&token=4f256f73-8fee-40b9-a76d-420615d263d6" className="menu-img img-fluid" style={{"paddingTop":"20%"}} alt="" /></a>
                <h4>Bajji</h4>
                <p className="ingredients">
                  Raw Banana, Onion, Chilly
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

              <div className="col-lg-4 menu-item">
                <a href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fpazham-pori.webp?alt=media&token=e5f97f7f-a016-414b-a998-b764e991195f" className="glightbox"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fmenu%2FSnacks%20%26%20Beverages%2Fpazham-pori.webp?alt=media&token=e5f97f7f-a016-414b-a998-b764e991195f" className="menu-img img-fluid" alt="" /></a>
                <h4>Other Snacks</h4>
                <p className="ingredients">
                  Bonda, Pazham pori
                </p>
                {/*  <p className="price">
                </p>  */}
              </div>{/*  Menu Item  */}

            </div>
          </div>{/*  End Dinner Menu Content  */}

        </div>

      </div>
    </section>{/*  End Menu Section  */}

    {/*  ======= Gallery Section =======  */}
    <section id="gallery" className="gallery section-bg">
      <div className="container" data-aos="fade-up">

        <div className="section-header">
          <h2>gallery</h2>
          <p>Check <span>Our Gallery</span></p>
        </div>

        <div className="gallery-slider swiper">
          <div className="swiper-wrapper align-items-center">
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg1.webp?alt=media&token=f91b1056-fe70-4ad9-b18b-7c15052baa70"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg1.webp?alt=media&token=f91b1056-fe70-4ad9-b18b-7c15052baa70" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg2.webp?alt=media&token=3f539f95-ae0f-4fe9-b86d-b3664a3b17d3"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg2.webp?alt=media&token=3f539f95-ae0f-4fe9-b86d-b3664a3b17d3" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg3.webp?alt=media&token=ee1ee7da-12e0-46bf-ad42-2a6e97319eae"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg3.webp?alt=media&token=ee1ee7da-12e0-46bf-ad42-2a6e97319eae" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg4.webp?alt=media&token=5ad621b9-ee22-492d-a109-afe2655fdfdd"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg4.webp?alt=media&token=5ad621b9-ee22-492d-a109-afe2655fdfdd" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg5.webp?alt=media&token=1043ded3-dbe9-4059-88a9-c04a2ec6c91f"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg5.webp?alt=media&token=1043ded3-dbe9-4059-88a9-c04a2ec6c91f" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg6.webp?alt=media&token=10d82977-cef3-44e4-9627-bcd3658474cd"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg6.webp?alt=media&token=10d82977-cef3-44e4-9627-bcd3658474cd" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg7.webp?alt=media&token=28f0ebb7-75b7-4295-95cc-e071b7ba55a1"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg7.webp?alt=media&token=28f0ebb7-75b7-4295-95cc-e071b7ba55a1" className="img-fluid" alt="" /></a></div>
            <div className="swiper-slide"><a className="glightbox" data-gallery="images-gallery" href="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg8.webp?alt=media&token=644f51e5-9044-462f-8ffa-de57c4cb1737"><img src="https://firebasestorage.googleapis.com/v0/b/sreevaishnaves.appspot.com/o/image%2Fsreevaishnaves%2Fgallery%2Fimg8.webp?alt=media&token=644f51e5-9044-462f-8ffa-de57c4cb1737" className="img-fluid" alt="" /></a></div>
          </div>
          <div className="swiper-pagination"></div>
        </div>

      </div>
    </section>{/*  End Gallery Section  */}

    {/*  ======= Contact Section =======  */}
    <section id="contact" className="contact">  
      <div className="container" data-aos="fade-up">

        <div className="section-header">
          <h2>Contact</h2>
          <p>Need Help? <span>Contact Us</span></p>
        </div>

        <div className="mb-3">
          <iframe style={{"border":"0","width":"100%","height":"350px"}} src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d15617.957214420016!2d75.3640015!3d11.8709781!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ba43d4b99705855%3A0xa9d33b2a2512eb4d!2sHotel%20Sree%20Vaishnaves!5e0!3m2!1sen!2sin!4v1676820239368!5m2!1sen!2sin" width="600" height="450" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
        </div>{/*  End Google Maps  */}

        <div className="row gy-4">

          <div className="col-md-6">
            <div className="info-item  d-flex align-items-center">
              <i className="icon bi bi-map flex-shrink-0"></i>
              <div>
                <h3>Our Address</h3>
                <p>Rajiv Gandhi Rd, Kannur, Kerala 670001</p>
              </div>
            </div>
          </div>{/*  End Info Item  */}

          <div className="col-md-6">
            <div className="info-item d-flex align-items-center">
              <i className="icon bi bi-envelope flex-shrink-0"></i>
              <div>
                <h3>Email Us</h3>
                <p>hotelsreevaishnaves@gmail.com</p>
              </div>
            </div>
          </div>{/*  End Info Item  */}

          <div className="col-md-6">
            <div className="info-item  d-flex align-items-center">
              <i className="icon bi bi-telephone flex-shrink-0"></i>
              <div>
                <h3>Call Us</h3>
                <p>0497 2766399</p>
              </div>
            </div>
          </div>{/*  End Info Item  */}

          <div className="col-md-6">
            <div className="info-item  d-flex align-items-center">
              <i className="icon bi bi-share flex-shrink-0"></i>
              <div>
                <h3>Opening Hours</h3>
                <div><strong>Mon-Sun:</strong> 6AM - 10PM
                  {/*  <strong>Sunday:</strong> Closed  */}
                </div>
              </div>
            </div>
          </div>{/*  End Info Item  */}
        </div>
      </div>
    </section>{/*  End Contact Section  */}

  </main>{/*  End #main  */}

  {/*  ======= Footer =======  */}
  <footer id="footer" className="footer">

    <div className="container">
      <div className="row gy-3">
        <div className="col-lg-3 col-md-6 d-flex">
          <i className="bi bi-geo-alt icon"></i>
          <div>
            <h4>Address</h4>
            <p>
              Rajiv Gandhi Rd <br />
              Kannur, Kerala - 670001<br />
            </p>
          </div>

        </div>

        <div className="col-lg-3 col-md-6 footer-links d-flex">
          <i className="bi bi-telephone icon"></i>
          <div>
            <h4>Parcel Order</h4>
            <p>
              <strong>Phone:</strong> 0497 2766399<br />
              {/*  <strong>Email:</strong> hotelsreevaishnaves@gmai.com<br />  */}
            </p>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 footer-links d-flex">
          <i className="bi bi-clock icon"></i>
          <div>
            <h4>Opening Hours</h4>
            <p>
              <strong>Mon-Sun:</strong>  6AM- 10PM<br />
            </p>
          </div>
        </div>

        <div className="col-lg-3 col-md-6 footer-links">
          <h4>Follow Us</h4>
          <div className="social-links d-flex">
            {/*  <a href="#" className="twitter"><i className="bi bi-twitter"></i></a>  */}
            <a href="https://www.facebook.com/people/Hotel-Sree-Vaishnaves/100063706583698/" target="_blank" className="facebook"><i className="bi bi-facebook"></i></a>
            <a href="https://www.instagram.com/hotel_sree_vaishnaves/" target="_blank" className="instagram"><i className="bi bi-instagram"></i></a>
            {/*  <a href="#" className="linkedin"><i className="bi bi-linkedin"></i></a>  */}
          </div>
        </div>

      </div>
    </div>

    <div className="container">
      <div className="copyright">
        &copy; Copyright <strong><span>Hotel Sree Vaishnaves</span></strong>. All Rights Reserved
      </div>
      <div className="credits">
        Designed by <a href="https://www.instagram.com/abhishek_shankar_381/" target="_blank">Abhishek S</a>
      </div>

    </div>

  </footer>{/*  End Footer  */}
  {/*  End Footer  */}

  <a href="#" className="scroll-top d-flex align-items-center justify-content-center"><i className="bi bi-arrow-up-short"></i></a>

  <div id="preloader" suppressHydrationWarning></div>

      {/* -- Vendor JS -------------------------------------------- */}
      <Script src="/assets/vendor/bootstrap/js/bootstrap.bundle.min.js" strategy="afterInteractive" />
      <Script src="/assets/vendor/aos/aos.js" strategy="afterInteractive" />
      <Script src="/assets/vendor/glightbox/js/glightbox.min.js" strategy="afterInteractive" />
      <Script src="/assets/vendor/purecounter/purecounter_vanilla.js" strategy="afterInteractive" />
      <Script src="/assets/vendor/swiper/swiper-bundle.min.js" strategy="afterInteractive" />
      <Script src="/assets/js/main.js" strategy="afterInteractive" />
    </>
  )
}
