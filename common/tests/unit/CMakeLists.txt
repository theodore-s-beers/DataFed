# Each test listed in Alphabetical order
foreach(PROG
    test_Buffer
    test_CommunicatorFactory
    test_Frame
    test_DynaLog
    test_MessageFactory
    test_OperatorFactory
    test_ProtoBufFactory
    test_ProtoBufMap
    test_Proxy
    test_ProxyBasicZMQ
    test_SocketFactory
    test_SocketOptions
)

  include_directories(${PROJECT_SOURCE_DIR}/common/source)
  file(GLOB ${PROG}_SOURCES ${PROG}.cpp)
  add_executable(unit_${PROG} ${${PROG}_SOURCES})
  target_link_libraries(unit_${PROG} ${Boost_LIBRARIES} common PkgConfig::PkgConfig_ZMQ ${Protobuf_LIBRARIES} Threads::Threads)
  target_compile_definitions(unit_${PROG} PRIVATE BOOST_TEST_DYN_LINK)
  add_test(unit_${PROG} unit_${PROG})
   
endforeach(PROG)

